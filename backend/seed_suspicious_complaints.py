#!/usr/bin/env python3
"""
seed_suspicious_complaints.py
------------------------------
Seeds 6 realistic suspicious/flagged complaints into MongoDB for testing
the Super Admin Suspicious & Anomaly Queue and verifying the District Approval workflow.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017/civic-issue-reporting"

SUSPICIOUS_REPORTS = [
    {
        "complaintId": "CIV-SUSP-101",
        "category": "pothole",
        "description": "asdfghjk qwertyuiop zxcvbnm test report repetitive characters road broken completely",
        "address": "NH-19 Mathura Road (Outside NCR Boundary), UP/Delhi Border",
        "latitude": 27.8920,
        "longitude": 78.0410,
        "district_id": "central_delhi",
        "district_name": "Central Delhi",
        "department": "Roads Department",
        "priority": "HIGH",
        "suspiciousScore": 0.88,
        "suspiciousReasons": [
            "GPS coordinates outside Delhi National Capital Territory (Lat: 27.8920, Lng: 78.0410)",
            "Repetitive gibberish pattern detected in description text"
        ],
        "images": ["image_048222bdb38c.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
    {
        "complaintId": "CIV-SUSP-102",
        "category": "broken_streetlight",
        "description": "dark",
        "address": "Barakhamba Road, Connaught Place, New Delhi - 110001",
        "latitude": 28.6315,
        "longitude": 77.2270,
        "district_id": "central_delhi",
        "district_name": "Central Delhi",
        "department": "Electrical Department",
        "priority": "MEDIUM",
        "suspiciousScore": 0.78,
        "suspiciousReasons": [
            "Extremely brief description (less than 10 characters)",
            "High frequency submission spike (7 complaints detected from device within 1 hour)"
        ],
        "images": ["image_5520f317e78f.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
    {
        "complaintId": "CIV-SUSP-103",
        "category": "garbage",
        "description": "Suspicious illegal industrial chemical waste dumped near riverbank, reported by automated hook.",
        "address": "Ring Road near Sarai Kale Khan, South Delhi - 110013",
        "latitude": 28.5880,
        "longitude": 77.2580,
        "district_id": "south_delhi",
        "district_name": "South Delhi",
        "department": "Sanitation Department",
        "priority": "CRITICAL",
        "suspiciousScore": 0.72,
        "suspiciousReasons": [
            "Low AI visual verification confidence (18% match with civic categories)",
            "High submission velocity from unverified device identifier"
        ],
        "images": ["image_63558ad6b0bd.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
    {
        "complaintId": "CIV-SUSP-104",
        "category": "drainage",
        "description": "water overflow everywhere overflowing drains",
        "address": "Near Jaipur-Delhi Express Highway Milestone 44",
        "latitude": 27.1500,
        "longitude": 76.5100,
        "district_id": "new_delhi",
        "district_name": "New Delhi",
        "department": "Drainage Department",
        "priority": "HIGH",
        "suspiciousScore": 0.92,
        "suspiciousReasons": [
            "GPS coordinates outside Delhi National Capital Territory (Lat: 27.1500, Lng: 76.5100)",
            "Extremely brief description and lacking street landmark evidence"
        ],
        "images": ["image_eabe027491ec.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
    {
        "complaintId": "CIV-SUSP-105",
        "category": "road_damage",
        "description": "xxxxxxxxxx duplicate spam attack repeated reporting testing system vulnerability",
        "address": "GT Karnal Road, Azadpur, North Delhi - 110033",
        "latitude": 28.7120,
        "longitude": 77.1750,
        "district_id": "north_delhi",
        "district_name": "North Delhi",
        "department": "Roads Department",
        "priority": "HIGH",
        "suspiciousScore": 0.85,
        "suspiciousReasons": [
            "Repeated character sequence spam pattern identified",
            "Rapid burst submission (4 reports within 90 seconds from same IP)"
        ],
        "images": ["image_437eafa12267.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
    {
        "complaintId": "CIV-SUSP-106",
        "category": "water_issue",
        "description": "pipeline leak burst water pipe flooding entire sector",
        "address": "Sector 21 Dwarka Flyover Border, West Delhi - 110077",
        "latitude": 28.5520,
        "longitude": 77.0610,
        "district_id": "west_delhi",
        "district_name": "West Delhi",
        "department": "Water Supply Department",
        "priority": "MEDIUM",
        "suspiciousScore": 0.68,
        "suspiciousReasons": [
            "Mismatch between reported EXIF geotag and device GPS sensor",
            "Frequent duplicate reports filed for same coordinates"
        ],
        "images": ["image_82b6a6b3d921.jpg"],
        "needsReview": True,
        "isSuspicious": True,
        "status": "UNDER_REVIEW",
    },
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client["civic-issue-reporting"]

    now = datetime.now(timezone.utc)

    # First remove any existing sample suspicious complaints
    await db.complaints.delete_many({"complaintId": {"$regex": "^CIV-SUSP-"}})

    demo_user = await db.users.find_one({"email": "demo@civicpulse.in"})
    demo_user_id = demo_user["_id"] if demo_user else None

    inserted = 0
    for r in SUSPICIOUS_REPORTS:
        doc = {
            "complaintId": r["complaintId"],
            "citizenId": demo_user_id,
            "category": r["category"],
            "status": r["status"],
            "description": r["description"],
            "address": r["address"],
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "location": {
                "type": "Point",
                "coordinates": [r["longitude"], r["latitude"]]
            },
            "district_id": r["district_id"],
            "district_name": r["district_name"],
            "department": r["department"],
            "priority": r["priority"],
            "images": r["images"],
            "evidenceHashes": [],
            "needsReview": r["needsReview"],
            "reviewFlags": r["suspiciousReasons"],
            "isSuspicious": r["isSuspicious"],
            "suspiciousReasons": r["suspiciousReasons"],
            "suspiciousScore": r["suspiciousScore"],
            "imageMetadata": [],
            "metadataChecks": [],
            "isAnonymous": False,
            "reporterName": "Citizen / Automated Trigger",
            "reporterPhone": "9876543210",
            "voiceNote": None,
            "upvotes": 0,
            "upvotedBy": [],
            "community_confirmations": 0,
            "submissionRateKey": str(demo_user_id) if demo_user_id else "demo",
            "createdAt": now - timedelta(minutes=20 * (inserted + 1)),
            "updatedAt": now - timedelta(minutes=20 * (inserted + 1)),
            "status_history": [
                {
                    "from_status": None,
                    "to_status": "UNDER_REVIEW",
                    "changed_by": None,
                    "changed_by_role": "SYSTEM",
                    "changed_by_name": "Anti-Spam Filter",
                    "changed_at": now - timedelta(minutes=20 * (inserted + 1)),
                    "comment": "Report flagged by automated Anti-Spam Integrity System. Placed in Super Admin review queue.",
                    "evidence": None
                }
            ],
            "isDemo": True,
        }
        await db.complaints.insert_one(doc)
        inserted += 1

    print(f"Successfully seeded {inserted} suspicious complaints into MongoDB!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
