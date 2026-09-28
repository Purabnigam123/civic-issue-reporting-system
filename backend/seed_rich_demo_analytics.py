#!/usr/bin/env python3
"""
seed_rich_demo_analytics.py
----------------------------
Seeds realistic demo issues across Delhi NCT districts, populating:
1. Super Admin "Escalated Civic Issues & SLA Breaches" action queue
2. District Escalation & Risk Distribution charts
3. Departmental Resolution Efficiency metrics
4. Geospatial incident heatmap across Delhi
5. District Work Completion Verification queue (RESOLUTION_SUBMITTED)
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

MONGO_URI = "mongodb://localhost:27017/civic-issue-reporting"

DELHI_DISTRICTS = [
    {"id": "central_delhi", "name": "Central Delhi", "lat": 28.6448, "lng": 77.2167},
    {"id": "new_delhi", "name": "New Delhi", "lat": 28.6139, "lng": 77.2090},
    {"id": "south_delhi", "name": "South Delhi", "lat": 28.5355, "lng": 77.2100},
    {"id": "north_west_delhi", "name": "North West Delhi", "lat": 28.7180, "lng": 77.1350},
    {"id": "east_delhi", "name": "East Delhi", "lat": 28.6280, "lng": 77.2950},
    {"id": "west_delhi", "name": "West Delhi", "lat": 28.6400, "lng": 77.1150},
    {"id": "north_delhi", "name": "North Delhi", "lat": 28.6850, "lng": 77.2100},
    {"id": "south_west_delhi", "name": "South West Delhi", "lat": 28.5800, "lng": 77.0600},
    {"id": "shahdara", "name": "Shahdara", "lat": 28.6700, "lng": 77.3050},
]

DEPARTMENTS = {
    "pothole": "Roads Department",
    "road_damage": "Roads Department",
    "broken_streetlight": "Electrical Department",
    "garbage": "Sanitation Department",
    "drainage": "Drainage Department",
    "water_issue": "Water Supply Department",
    "public_property": "Public Works Department",
    "other": "General Administration",
}

SAMPLE_IMAGES = [
    "image_02c5606228f1.png",
    "image_1de4cfc7648c.png",
    "image_28d17208aa69.jpg",
    "image_4b53699b4694.jpg",
    "image_5520f317e78f.jpg",
]


async def run_seed():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_default_database()
    now = datetime.now(timezone.utc)

    # 1. Backfill existing complaints that have null district_id
    null_districts = await db.complaints.find({"district_id": None}).to_list(200)
    print(f"Backfilling {len(null_districts)} complaints with null district_id...")
    for idx, c in enumerate(null_districts):
        dist = DELHI_DISTRICTS[idx % len(DELHI_DISTRICTS)]
        lat = dist["lat"] + random.uniform(-0.02, 0.02)
        lng = dist["lng"] + random.uniform(-0.02, 0.02)
        cat = c.get("category", "other")
        dept = DEPARTMENTS.get(cat, "General Administration")
        
        # Set realistic SLA deadlines
        sla_hours = 48 if c.get("priority") == "MEDIUM" else 24
        created = c.get("createdAt") or (now - timedelta(days=2))
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        sla_deadline = created + timedelta(hours=sla_hours)

        await db.complaints.update_one(
            {"_id": c["_id"]},
            {
                "$set": {
                    "district_id": dist["id"],
                    "district_name": dist["name"],
                    "department": dept,
                    "latitude": round(lat, 6),
                    "longitude": round(lng, 6),
                    "slaDeadline": sla_deadline,
                    "slaStatus": "RESOLVED_ON_TIME" if c.get("status") == "RESOLVED" else "ON_TRACK",
                }
            }
        )

    # 2. Fetch workers by district
    workers_cursor = db.users.find({"role": "WORKER"})
    all_workers = await workers_cursor.to_list(50)
    worker_by_district = {}
    for w in all_workers:
        d_id = w.get("district_id")
        if d_id:
            worker_by_district[d_id] = w

    # Get citizen user
    demo_citizen = await db.users.find_one({"email": "demo@civicpulse.in"})
    citizen_id = demo_citizen["_id"] if demo_citizen else ObjectId()

    # Determine max complaint sequence
    max_num = 10100
    cid_cursor = db.complaints.find({"complaintId": {"$regex": r"^CIV-\d+$"}}, {"complaintId": 1}).sort("complaintId", -1).limit(20)
    for c in await cid_cursor.to_list(20):
        try:
            num = int(c.get("complaintId", "").split("-")[1])
            if num > max_num:
                max_num = num
        except Exception:
            pass

    new_docs = []

    # ══════════════════════════════════════════════════════════════════════════
    # A. ESCALATED COMPLAINTS (4 items) -> Show up in Super Admin Escalation Queue
    # ══════════════════════════════════════════════════════════════════════════
    escalated_items = [
        {
            "category": "water_issue",
            "district": DELHI_DISTRICTS[0], # Central Delhi
            "title": "Severe Main Pipeline Burst - Connaught Circus Inner Ring",
            "desc": "High pressure water pipe burst flooding road and shutting down water to commercial block. 36 hours elapsed without repair crew arrival.",
            "addr": "Block B, Radial Road 2, Connaught Place, Central Delhi - 110001",
            "priority": "CRITICAL",
            "hours_ago_created": 60,
            "overdue_hours": 36,
            "escalation_reason": "Resolution deadline breached by 36 hours. Critical arterial flooding.",
        },
        {
            "category": "pothole",
            "district": DELHI_DISTRICTS[3], # North West Delhi
            "title": "Massive Crater near Pitampura Metro Pillar 342",
            "desc": "Deep crater spanning across two lanes on Outer Ring Road. Two two-wheelers suffered tire damage this morning. Urgent asphalt patch required.",
            "addr": "Near Pillar 342, Madhuban Chowk, Pitampura, North West Delhi - 110034",
            "priority": "HIGH",
            "hours_ago_created": 48,
            "overdue_hours": 24,
            "escalation_reason": "SLA deadline exceeded. High risk of accidents on high-speed corridor.",
        },
        {
            "category": "broken_streetlight",
            "district": DELHI_DISTRICTS[2], # South Delhi
            "title": "Unlit Residential Stretch & Exposed High Voltage Wire",
            "desc": "Damaged streetlight pole with dangling live wire touching metal fence near community park. Children play nearby every evening.",
            "addr": "Sector 4 Main Road, RK Puram, South Delhi - 110022",
            "priority": "HIGH",
            "hours_ago_created": 40,
            "overdue_hours": 16,
            "escalation_reason": "Critical public safety hazard. Electrical department response overdue.",
        },
        {
            "category": "garbage",
            "district": DELHI_DISTRICTS[4], # East Delhi
            "title": "Overflowing Open Garbage Dump - Hospital Approach Road",
            "desc": "Medical and municipal waste piled up across 50 meters blocking the ambulance approach road to Lal Bahadur Shastri Hospital.",
            "addr": "Khichripur Main Road, Kalyanvas, East Delhi - 110091",
            "priority": "HIGH",
            "hours_ago_created": 44,
            "overdue_hours": 20,
            "escalation_reason": "Sanitation emergency on critical health infrastructure corridor.",
        },
    ]

    for item in escalated_items:
        max_num += 1
        d = item["district"]
        worker = worker_by_district.get(d["id"]) or (all_workers[0] if all_workers else None)
        created_time = now - timedelta(hours=item["hours_ago_created"])
        deadline = now - timedelta(hours=item["overdue_hours"])
        doc = {
            "complaintId": f"CIV-{max_num}",
            "citizenId": citizen_id,
            "category": item["category"],
            "status": "ESCALATED",
            "isEscalated": True,
            "escalationReason": item["escalation_reason"],
            "escalatedAt": deadline,
            "priority": item["priority"],
            "department": DEPARTMENTS[item["category"]],
            "district_id": d["id"],
            "district_name": d["name"],
            "title": item["title"],
            "description": item["desc"],
            "address": item["addr"],
            "latitude": round(d["lat"] + random.uniform(-0.01, 0.01), 6),
            "longitude": round(d["lng"] + random.uniform(-0.01, 0.01), 6),
            "slaDeadline": deadline,
            "slaStatus": "BREACHED",
            "assignedWorkerId": str(worker["_id"]) if worker else None,
            "assignedWorkerName": worker.get("name", "Assigned Worker") if worker else "Field Worker",
            "images": [SAMPLE_IMAGES[random.randint(0, len(SAMPLE_IMAGES) - 1)]],
            "upvotes": random.randint(12, 45),
            "createdAt": created_time,
            "updatedAt": now - timedelta(hours=2),
            "isDemo": True,
        }
        new_docs.append(doc)

    # ══════════════════════════════════════════════════════════════════════════
    # B. RESOLUTION_SUBMITTED (3 items) -> Show up in District Verification Queue
    # ══════════════════════════════════════════════════════════════════════════
    verification_items = [
        {
            "category": "pothole",
            "district": DELHI_DISTRICTS[3], # North West Delhi
            "desc": "Dangerous road depression repaired near Netaji Subhash Place underpass.",
            "addr": "Ring Road, Netaji Subhash Place, Pitampura, North West Delhi - 110034",
            "worker_notes": "Filled with bituminous cold mix, leveled and compacted. Curing complete.",
            "before_img": SAMPLE_IMAGES[0],
            "after_img": SAMPLE_IMAGES[1],
        },
        {
            "category": "broken_streetlight",
            "district": DELHI_DISTRICTS[0], # Central Delhi
            "desc": "Defective sodium vapor lamp replaced with 90W LED luminaire.",
            "addr": "Paharganj Main Bazar, Near Railway Station, Central Delhi - 110055",
            "worker_notes": "Replaced damaged choke and fitted new 90W energy efficient LED panel. Illumination verified.",
            "before_img": SAMPLE_IMAGES[2],
            "after_img": SAMPLE_IMAGES[3],
        },
        {
            "category": "drainage",
            "district": DELHI_DISTRICTS[2], # South Delhi
            "desc": "Heavy silt blockage cleared from stormwater drain ahead of monsoon.",
            "addr": "Ring Road Flyover, South Extension Part I, South Delhi - 110049",
            "worker_notes": "De-silted 35 meters of closed drain using super suction unit. Water flow restored.",
            "before_img": SAMPLE_IMAGES[4],
            "after_img": SAMPLE_IMAGES[0],
        },
    ]

    for item in verification_items:
        max_num += 1
        d = item["district"]
        worker = worker_by_district.get(d["id"]) or (all_workers[0] if all_workers else None)
        created_time = now - timedelta(hours=random.randint(18, 30))
        submitted_time = now - timedelta(hours=random.randint(1, 4))
        doc = {
            "complaintId": f"CIV-{max_num}",
            "citizenId": citizen_id,
            "category": item["category"],
            "status": "RESOLUTION_SUBMITTED",
            "isEscalated": False,
            "priority": "MEDIUM",
            "department": DEPARTMENTS[item["category"]],
            "district_id": d["id"],
            "district_name": d["name"],
            "description": item["desc"],
            "address": item["addr"],
            "latitude": round(d["lat"] + random.uniform(-0.01, 0.01), 6),
            "longitude": round(d["lng"] + random.uniform(-0.01, 0.01), 6),
            "slaDeadline": now + timedelta(hours=24),
            "slaStatus": "ON_TRACK",
            "assignedWorkerId": str(worker["_id"]) if worker else None,
            "assignedWorkerName": worker.get("name", "Field Officer") if worker else "Field Worker",
            "images": [item["before_img"]],
            "resolutionProof": [item["after_img"]],
            "workerNotes": item["worker_notes"],
            "resolutionSubmittedAt": submitted_time,
            "ai_verification": {
                "score": 0.94,
                "confidence": 0.96,
                "matched": True,
                "summary": "AI image analysis confirms repair resolution matches reported defect geometry.",
            },
            "upvotes": random.randint(3, 15),
            "createdAt": created_time,
            "updatedAt": submitted_time,
            "isDemo": True,
        }
        new_docs.append(doc)

    # ══════════════════════════════════════════════════════════════════════════
    # C. RESOLVED COMPLAINTS (10 items) -> Boost Department & District Charts
    # ══════════════════════════════════════════════════════════════════════════
    resolved_categories = [
        ("pothole", DELHI_DISTRICTS[1]),
        ("pothole", DELHI_DISTRICTS[2]),
        ("broken_streetlight", DELHI_DISTRICTS[3]),
        ("broken_streetlight", DELHI_DISTRICTS[0]),
        ("garbage", DELHI_DISTRICTS[4]),
        ("garbage", DELHI_DISTRICTS[5]),
        ("water_issue", DELHI_DISTRICTS[1]),
        ("drainage", DELHI_DISTRICTS[6]),
        ("public_property", DELHI_DISTRICTS[7]),
        ("road_damage", DELHI_DISTRICTS[8]),
    ]

    for cat, dist in resolved_categories:
        max_num += 1
        created_time = now - timedelta(days=random.randint(3, 10))
        resolved_time = created_time + timedelta(hours=random.randint(8, 28))
        doc = {
            "complaintId": f"CIV-{max_num}",
            "citizenId": citizen_id,
            "category": cat,
            "status": "RESOLVED",
            "isEscalated": False,
            "priority": "MEDIUM",
            "department": DEPARTMENTS[cat],
            "district_id": dist["id"],
            "district_name": dist["name"],
            "description": f"Civic maintenance resolution completed successfully for {cat.replace('_', ' ')}.",
            "address": f"Near Sector Market, {dist['name']}, New Delhi",
            "latitude": round(dist["lat"] + random.uniform(-0.015, 0.015), 6),
            "longitude": round(dist["lng"] + random.uniform(-0.015, 0.015), 6),
            "slaDeadline": created_time + timedelta(hours=48),
            "slaStatus": "RESOLVED_ON_TIME",
            "resolvedAt": resolved_time,
            "images": [SAMPLE_IMAGES[random.randint(0, len(SAMPLE_IMAGES) - 1)]],
            "upvotes": random.randint(5, 20),
            "createdAt": created_time,
            "updatedAt": resolved_time,
            "isDemo": True,
        }
        new_docs.append(doc)

    # ══════════════════════════════════════════════════════════════════════════
    # D. IN_PROGRESS COMPLAINTS (6 items) -> Active in Field
    # ══════════════════════════════════════════════════════════════════════════
    in_prog_categories = [
        ("pothole", DELHI_DISTRICTS[5]),
        ("water_issue", DELHI_DISTRICTS[0]),
        ("garbage", DELHI_DISTRICTS[2]),
        ("broken_streetlight", DELHI_DISTRICTS[1]),
        ("drainage", DELHI_DISTRICTS[3]),
        ("public_property", DELHI_DISTRICTS[4]),
    ]

    for cat, dist in in_prog_categories:
        max_num += 1
        worker = worker_by_district.get(dist["id"]) or (all_workers[0] if all_workers else None)
        created_time = now - timedelta(hours=random.randint(6, 18))
        doc = {
            "complaintId": f"CIV-{max_num}",
            "citizenId": citizen_id,
            "category": cat,
            "status": "IN_PROGRESS",
            "isEscalated": False,
            "priority": "MEDIUM",
            "department": DEPARTMENTS[cat],
            "district_id": dist["id"],
            "district_name": dist["name"],
            "description": f"Field repair team currently addressing {cat.replace('_', ' ')} incident.",
            "address": f"Main Road, {dist['name']}, New Delhi",
            "latitude": round(dist["lat"] + random.uniform(-0.015, 0.015), 6),
            "longitude": round(dist["lng"] + random.uniform(-0.015, 0.015), 6),
            "slaDeadline": now + timedelta(hours=random.randint(14, 34)),
            "slaStatus": "ON_TRACK",
            "assignedWorkerId": str(worker["_id"]) if worker else None,
            "assignedWorkerName": worker.get("name", "Field Worker") if worker else "Field Worker",
            "images": [SAMPLE_IMAGES[random.randint(0, len(SAMPLE_IMAGES) - 1)]],
            "upvotes": random.randint(2, 10),
            "createdAt": created_time,
            "updatedAt": now - timedelta(hours=1),
            "isDemo": True,
        }
        new_docs.append(doc)

    # Insert into database
    res = await db.complaints.insert_many(new_docs)
    print(f"Successfully inserted {len(res.inserted_ids)} rich demo complaints into MongoDB!")

    # Update sequence counter
    await db.counters.update_one(
        {"_id": "complaintId"},
        {"$max": {"seq": max_num}},
        upsert=True,
    )
    print(f"Max complaintId counter updated to CIV-{max_num}")

    client.close()


if __name__ == "__main__":
    asyncio.run(run_seed())
