"""
Predictive Civic Hotspots Service: analyzes historical complaint density, 
category frequency, and time trends by zone/district to identify areas 
likely to generate future complaints.

All predictions are based on actual historical data patterns.
Explicitly reports "insufficient data" when dataset is too small.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from bson import ObjectId

from ..database.mongodb import get_database
from ..models.complaint import ComplaintStatus
from ..models.district import DELHI_DISTRICTS


MIN_COMPLAINTS_FOR_PREDICTION = 5  # Minimum data points to make predictions


async def get_predictive_hotspots(
    days_lookback: int = 30,
    min_complaints: int = MIN_COMPLAINTS_FOR_PREDICTION,
) -> Dict[str, Any]:
    """
    Analyze historical complaint patterns to predict future hotspots.

    Returns:
      - hotspots: list of district/category combinations with rising trends
      - district_trends: per-district trend analysis
      - category_trends: city-wide category trends
      - data_quality: assessment of prediction confidence
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    lookback_start = now - timedelta(days=days_lookback)

    total_complaints = await db.complaints.count_documents({
        "createdAt": {"$gte": lookback_start},
    })

    if total_complaints < min_complaints:
        return {
            "hotspots": [],
            "district_trends": [],
            "category_trends": [],
            "data_quality": {
                "total_complaints_analyzed": total_complaints,
                "sufficient_data": False,
                "message": f"Insufficient data for predictions. Need at least {min_complaints} complaints in the last {days_lookback} days, found {total_complaints}.",
                "confidence": 0.0,
            },
        }

    # Split period into two halves for trend comparison
    mid_point = lookback_start + timedelta(days=days_lookback / 2)

    # ── District-level trends ─────────────────────────────────────
    district_trends = []
    hotspots = []

    for district in DELHI_DISTRICTS:
        d_id = district["id"]
        d_name = district["name"]

        # First half count
        first_half = await db.complaints.count_documents({
            "district_id": d_id,
            "createdAt": {"$gte": lookback_start, "$lt": mid_point},
        })
        # Second half count
        second_half = await db.complaints.count_documents({
            "district_id": d_id,
            "createdAt": {"$gte": mid_point, "$lte": now},
        })

        total_district = first_half + second_half

        # Calculate trend
        if first_half > 0:
            trend_pct = round(((second_half - first_half) / first_half) * 100, 1)
        elif second_half > 0:
            trend_pct = 100.0  # New complaints appearing
        else:
            trend_pct = 0.0

        trend_direction = "rising" if trend_pct > 15 else ("declining" if trend_pct < -15 else "stable")

        # Top category for this district
        cat_pipeline = [
            {"$match": {"district_id": d_id, "createdAt": {"$gte": lookback_start}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 3},
        ]
        cat_results = await db.complaints.aggregate(cat_pipeline).to_list(None)
        top_categories = [{"category": c["_id"], "count": c["count"]} for c in cat_results if c.get("_id")]

        district_trend = {
            "district_id": d_id,
            "district_name": d_name,
            "total_complaints": total_district,
            "first_half_count": first_half,
            "second_half_count": second_half,
            "trend_percentage": trend_pct,
            "trend_direction": trend_direction,
            "top_categories": top_categories,
        }
        district_trends.append(district_trend)

        # Flag as hotspot if rising trend with significant volume
        if trend_direction == "rising" and total_district >= 3:
            confidence = min(0.3 + (total_district / 50.0) * 0.5, 0.85)
            hotspots.append({
                "district_id": d_id,
                "district_name": d_name,
                "type": "district_hotspot",
                "trend_percentage": trend_pct,
                "total_complaints": total_district,
                "top_category": top_categories[0]["category"] if top_categories else "other",
                "confidence": round(confidence, 2),
                "predicted_next_period": round(second_half * (1 + abs(trend_pct) / 200), 0),
                "recommendation": f"Rising complaints in {d_name} ({trend_pct:+.0f}%). Consider proactive resource allocation.",
            })

    # ── Category-level trends ─────────────────────────────────────
    cat_trend_pipeline = [
        {"$match": {"createdAt": {"$gte": lookback_start}}},
        {"$group": {
            "_id": "$category",
            "total": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    cat_trends_raw = await db.complaints.aggregate(cat_trend_pipeline).to_list(None)

    category_trends = []
    for ct in cat_trends_raw:
        cat_name = ct["_id"]
        if not cat_name:
            continue

        first_half = await db.complaints.count_documents({
            "category": cat_name,
            "createdAt": {"$gte": lookback_start, "$lt": mid_point},
        })
        second_half = await db.complaints.count_documents({
            "category": cat_name,
            "createdAt": {"$gte": mid_point, "$lte": now},
        })

        if first_half > 0:
            cat_trend_pct = round(((second_half - first_half) / first_half) * 100, 1)
        elif second_half > 0:
            cat_trend_pct = 100.0
        else:
            cat_trend_pct = 0.0

        category_trends.append({
            "category": cat_name,
            "total": ct["total"],
            "first_half": first_half,
            "second_half": second_half,
            "trend_percentage": cat_trend_pct,
            "trend_direction": "rising" if cat_trend_pct > 15 else ("declining" if cat_trend_pct < -15 else "stable"),
        })

    # Sort hotspots by confidence
    hotspots.sort(key=lambda x: x["confidence"], reverse=True)

    # Sort district trends by trend_percentage descending
    district_trends.sort(key=lambda x: x["trend_percentage"], reverse=True)

    # Data quality assessment
    confidence = min(0.3 + (total_complaints / 100.0) * 0.5, 0.9)

    return {
        "hotspots": hotspots[:10],
        "district_trends": district_trends,
        "category_trends": category_trends,
        "data_quality": {
            "total_complaints_analyzed": total_complaints,
            "sufficient_data": True,
            "lookback_days": days_lookback,
            "confidence": round(confidence, 2),
            "message": f"Analysis based on {total_complaints} complaints over the last {days_lookback} days.",
        },
    }
