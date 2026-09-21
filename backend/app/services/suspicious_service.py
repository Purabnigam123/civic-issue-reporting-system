"""
Suspicious Report Detection Service.
Analyzes complaints for spam, rapid submission spikes, out-of-bounds locations, and anomaly patterns.
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Tuple
from bson import ObjectId

from ..database.mongodb import get_database


DELHI_BOUNDS = {
    "min_lat": 28.30,
    "max_lat": 28.95,
    "min_lon": 76.80,
    "max_lon": 77.45,
}


async def evaluate_complaint_suspicion(
    citizen_id: str,
    title: str,
    description: str,
    lat: float,
    lng: float,
    ai_confidence: float = 1.0,
) -> Tuple[bool, List[str], float]:
    """
    Evaluates a complaint at creation time.
    Returns: (is_suspicious, reasons, suspicious_score between 0.0 and 1.0)
    """
    db = get_database()
    reasons: List[str] = []
    score = 0.0

    # 1. Geographic bounds check
    if not (DELHI_BOUNDS["min_lat"] <= lat <= DELHI_BOUNDS["max_lat"] and
            DELHI_BOUNDS["min_lon"] <= lng <= DELHI_BOUNDS["max_lon"]):
        reasons.append("GPS coordinates outside Delhi National Capital Territory")
        score += 0.45

    # 2. Text quality check
    clean_desc = (description or "").strip()
    clean_title = (title or "").strip()
    if len(clean_desc) < 10 or len(clean_title) < 4:
        reasons.append("Extremely brief title or description")
        score += 0.25

    # Check repetitive character spam (e.g. "aaaaa", "asdfasdfasdf")
    if clean_desc and len(set(clean_desc.lower().replace(" ", ""))) <= 3:
        reasons.append("Repetitive gibberish detected in description")
        score += 0.40

    # 3. High submission velocity (more than 5 complaints by same user in past 1 hour)
    if citizen_id:
        try:
            one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
            cid = ObjectId(citizen_id) if ObjectId.is_valid(citizen_id) else citizen_id
            recent_count = await db.complaints.count_documents({
                "citizenId": cid,
                "createdAt": {"$gte": one_hour_ago},
            })
            if recent_count >= 5:
                reasons.append(f"High frequency submission ({recent_count} complaints in past hour)")
                score += 0.50
        except Exception:
            pass

    # 4. Low AI confidence
    if ai_confidence < 0.35:
        reasons.append(f"Low AI detection confidence ({round(ai_confidence * 100)}%)")
        score += 0.20

    is_suspicious = score >= 0.40
    return is_suspicious, reasons, round(min(score, 1.0), 2)
