#!/usr/bin/env python3
"""
seed_demo_complaints.py
-----------------------
Inserts 50 realistic sample civic complaints for the demo account.
Demo account: demo@civicpulse.in  /  Demo@1234

Run from the `backend/` directory:
    python seed_demo_complaints.py
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# ── Config ────────────────────────────────────────────────────────────────────
MONGO_URI = "mongodb://localhost:27017/civic-issue-reporting"
DEMO_EMAIL = "demo@civicpulse.in"
DEMO_PASSWORD = "Demo@1234"
DEMO_NAME = "Demo Citizen"
DEMO_PHONE = "9876543210"

# ── Seed data helpers ─────────────────────────────────────────────────────────

DEPARTMENTS = {
    "pothole": "Roads Department",
    "broken_streetlight": "Electrical Department",
    "garbage": "Sanitation Department",
    "drainage": "Drainage Department",
    "water_issue": "Water Supply Department",
    "public_property": "Public Works Department",
    "road_damage": "Roads Department",
    "other": "General Administration",
}

PRIORITIES = {
    "pothole": "MEDIUM",
    "broken_streetlight": "MEDIUM",
    "garbage": "LOW",
    "drainage": "HIGH",
    "water_issue": "HIGH",
    "public_property": "MEDIUM",
    "road_damage": "MEDIUM",
    "other": "LOW",
}

STATUSES = [
    "SUBMITTED","SUBMITTED","SUBMITTED",
    "UNDER_REVIEW","UNDER_REVIEW",
    "ASSIGNED",
    "IN_PROGRESS","IN_PROGRESS",
    "RESOLVED","RESOLVED","RESOLVED",
    "REOPENED",
]

# 50 realistic complaints across Indian cities
COMPLAINTS = [
    # POTHOLE (7)
    {"category": "pothole", "description": "Deep pothole near the main roundabout causing vehicle damage and traffic congestion during rush hours.", "address": "Near Rajiv Chowk, Connaught Place, New Delhi - 110001", "lat": 28.6328, "lng": 77.2197},
    {"category": "pothole", "description": "Large crater-sized pothole on the highway stretch causing accidents. Two bikes skidded here last week.", "address": "NH-48 Service Road, Sector 18, Gurugram - 122001", "lat": 28.4595, "lng": 77.0266},
    {"category": "pothole", "description": "Multiple potholes on the school road making it dangerous for children walking to school every morning.", "address": "Opposite DAV School, Lajpat Nagar II, New Delhi - 110024", "lat": 28.5665, "lng": 77.2431},
    {"category": "pothole", "description": "Road completely broken with potholes after the recent rains. Water gets collected making it impossible to drive.", "address": "Linking Road, Bandra West, Mumbai - 400050", "lat": 19.0596, "lng": 72.8295},
    {"category": "pothole", "description": "Series of potholes on arterial road causing severe traffic bottleneck. Road not repaired in over a year.", "address": "MG Road, Indiranagar, Bengaluru - 560038", "lat": 12.9716, "lng": 77.6412},
    {"category": "pothole", "description": "Dangerous pothole near bus stop. Bus passengers risk injury while boarding due to uneven road surface.", "address": "Near Anand Vihar Bus Terminal, Delhi - 110092", "lat": 28.6471, "lng": 77.3159},
    {"category": "pothole", "description": "Pothole on main market road has been worsening for 3 months. No action taken despite multiple complaints.", "address": "Karol Bagh Market, New Delhi - 110005", "lat": 28.6517, "lng": 77.1901},

    # BROKEN STREETLIGHT (6)
    {"category": "broken_streetlight", "description": "Entire stretch of 200 metres completely dark at night. Residents fear for safety especially women returning home late.", "address": "Sector 56, Phase II, Gurugram - 122011", "lat": 28.4231, "lng": 77.0936},
    {"category": "broken_streetlight", "description": "Streetlight near park has been flickering and off for 2 weeks. Antisocial elements gather in the dark area at night.", "address": "Lodhi Garden Outer Road, New Delhi - 110003", "lat": 28.5933, "lng": 77.2210},
    {"category": "broken_streetlight", "description": "Three consecutive street lamps on the main avenue are not working. Traffic accidents likely to increase.", "address": "Pali Hill Road, Bandra East, Mumbai - 400051", "lat": 19.0549, "lng": 72.8491},
    {"category": "broken_streetlight", "description": "Power line damage has knocked out all streetlights on this lane. Completely unlit from 7pm onwards.", "address": "Koramangala 4th Block, Bengaluru - 560034", "lat": 12.9352, "lng": 77.6245},
    {"category": "broken_streetlight", "description": "LED streetlight panel shattered, exposed wires hanging loose — a serious electrical hazard for passersby.", "address": "Anna Salai, Teynampet, Chennai - 600018", "lat": 13.0497, "lng": 80.2567},
    {"category": "broken_streetlight", "description": "Streetlight pole tilted dangerously after being hit by a truck. The damaged wiring is sparking intermittently.", "address": "GT Karnal Road, Civil Lines, Delhi - 110054", "lat": 28.6757, "lng": 77.2140},

    # GARBAGE (6)
    {"category": "garbage", "description": "Garbage has not been collected for 5 days. Overflowing bins attracting stray animals and creating health hazard.", "address": "Kailash Colony Market, New Delhi - 110048", "lat": 28.5517, "lng": 77.2464},
    {"category": "garbage", "description": "Illegal dumping happening on the side of the road. Residents have complained multiple times with no action.", "address": "Near Deonar Dumping Ground, Chembur, Mumbai - 400088", "lat": 19.0560, "lng": 72.9207},
    {"category": "garbage", "description": "Public dustbin overflowing onto footpath. Foul smell affecting nearby shops and residents.", "address": "Chandni Chowk Market Lane, Delhi - 110006", "lat": 28.6506, "lng": 77.2296},
    {"category": "garbage", "description": "Construction debris dumped on residential road blocking pedestrian walkway and vehicle access.", "address": "Hauz Khas Village, New Delhi - 110016", "lat": 28.5494, "lng": 77.2001},
    {"category": "garbage", "description": "Garbage truck has missed this area for 6 days straight. Waste accumulation posing hygiene risks.", "address": "Koregaon Park, Pune - 411001", "lat": 18.5362, "lng": 73.8938},
    {"category": "garbage", "description": "Pile of garbage near the school gate. Children walking through garbage every day. Needs urgent intervention.", "address": "Near Ryan International School, Vasant Kunj, Delhi - 110070", "lat": 28.5243, "lng": 77.1571},

    # DRAINAGE (5)
    {"category": "drainage", "description": "Drainage completely blocked causing flooding on the entire street even after light rainfall. Standing water for 3 days.", "address": "Tilak Nagar, New Delhi - 110018", "lat": 28.6350, "lng": 77.0956},
    {"category": "drainage", "description": "Sewage overflowing onto the road creating unbearable stench. Health emergency for nearby residents.", "address": "Dharavi, Mumbai - 400017", "lat": 19.0437, "lng": 72.8501},
    {"category": "drainage", "description": "Blocked storm drain causing flash flooding every time it rains. Road impassable for over 2 hours after rains.", "address": "Electronic City Phase I, Bengaluru - 560100", "lat": 12.8445, "lng": 77.6637},
    {"category": "drainage", "description": "Broken manhole cover over drain. Pedestrians could fall in. Children in this locality are at serious risk.", "address": "Dwarka Sector 10, New Delhi - 110075", "lat": 28.5797, "lng": 77.0574},
    {"category": "drainage", "description": "Open drainage through residential colony creates mosquito breeding ground. Dengue cases rising in area.", "address": "Old Rajendra Nagar, New Delhi - 110060", "lat": 28.6384, "lng": 77.1731},

    # WATER ISSUE (5)
    {"category": "water_issue", "description": "Burst water main pipe flooding the road for 2 days. Thousands of litres wasted, road submerged.", "address": "ITO Crossing, IP Estate, New Delhi - 110002", "lat": 28.6289, "lng": 77.2479},
    {"category": "water_issue", "description": "No water supply to entire block for past 48 hours. Residents depending on tankers at high cost.", "address": "Mayur Vihar Phase 3, Delhi - 110096", "lat": 28.6042, "lng": 77.3183},
    {"category": "water_issue", "description": "Brown and contaminated water being supplied through taps. Strong foul smell. Water unusable for drinking or cooking.", "address": "Rohini Sector 7, Delhi - 110085", "lat": 28.7231, "lng": 77.1087},
    {"category": "water_issue", "description": "Water pressure extremely low. Water barely reaching first floor. Ground floor also affected from afternoon onwards.", "address": "Malad West, Mumbai - 400064", "lat": 19.1874, "lng": 72.8479},
    {"category": "water_issue", "description": "Water meter defective, billing incorrect for 3 months. Multiple complaints to water board with no resolution.", "address": "Basavanagudi, Bengaluru - 560004", "lat": 12.9418, "lng": 77.5749},

    # PUBLIC PROPERTY (6)
    {"category": "public_property", "description": "Park bench completely broken. Elderly residents have nowhere to sit. Broken metal pieces are a safety hazard.", "address": "Nehru Park, Chanakyapuri, New Delhi - 110021", "lat": 28.5985, "lng": 77.1890},
    {"category": "public_property", "description": "Bus shelter roof blown off in storm. Commuters exposed to sun and rain. Needs urgent repair.", "address": "Sarojini Nagar Bus Stop, New Delhi - 110023", "lat": 28.5745, "lng": 77.1955},
    {"category": "public_property", "description": "Public toilet facility near market in severely unhygienic condition. Door broken, floor flooded, no water.", "address": "Kamla Market, Ajmeri Gate, Delhi - 110006", "lat": 28.6443, "lng": 77.2265},
    {"category": "public_property", "description": "Playground equipment in the community park is rusted and broken. Children getting injured on exposed sharp edges.", "address": "Sanjay Lake Park, Trilokpuri, Delhi - 110091", "lat": 28.6239, "lng": 77.3087},
    {"category": "public_property", "description": "Street sign knocked down at major intersection causing confusion for drivers. Risk of accidents.", "address": "Ring Road Intersection, Lajpat Nagar, Delhi - 110024", "lat": 28.5663, "lng": 77.2409},
    {"category": "public_property", "description": "Public drinking water fountain broken and spewing water wastefully for a week. Nobody has come to fix it.", "address": "Cubbon Park, Bengaluru - 560001", "lat": 12.9763, "lng": 77.5929},

    # ROAD DAMAGE (6)
    {"category": "road_damage", "description": "Entire road markings faded completely. Lane discipline impossible at night. Urgent re-marking needed.", "address": "Outer Ring Road, Marathahalli, Bengaluru - 560037", "lat": 12.9591, "lng": 77.6974},
    {"category": "road_damage", "description": "Footpath tiles broken and uneven across 50 metres. Elderly and differently-abled people at high fall risk.", "address": "Connaught Place Outer Circle, New Delhi - 110001", "lat": 28.6322, "lng": 77.2194},
    {"category": "road_damage", "description": "Road surface badly damaged by overloaded vehicles. Entire stretch needs resurfacing immediately.", "address": "NH-8 Service Road, Manesar, Gurugram - 122050", "lat": 28.3570, "lng": 76.9376},
    {"category": "road_damage", "description": "Speed breakers painted incorrectly, not visible in rain or low-light conditions. Two accidents reported this week.", "address": "Vasant Vihar Main Road, New Delhi - 110057", "lat": 28.5582, "lng": 77.1624},
    {"category": "road_damage", "description": "Flyover approach road severely damaged with cracks. Risk of further deterioration especially during monsoon.", "address": "Mahim Causeway, Mumbai - 400016", "lat": 19.0372, "lng": 72.8440},
    {"category": "road_damage", "description": "Divider in the middle of the road broken and missing at key junction. Creates head-on collision risk.", "address": "Subhash Marg, Civil Lines, Delhi - 110054", "lat": 28.6749, "lng": 77.2257},

    # OTHER (9)
    {"category": "other", "description": "Stray dogs menacing residents in the colony. Biting incidents reported near the school. Requires animal control.", "address": "Chittranjan Park, New Delhi - 110019", "lat": 28.5461, "lng": 77.2578},
    {"category": "other", "description": "Noise pollution from construction work starting at 4am daily violating municipal by-laws. Residents unable to sleep.", "address": "Defence Colony, New Delhi - 110024", "lat": 28.5721, "lng": 77.2283},
    {"category": "other", "description": "Illegal encroachment on public footpath by vendors. Pedestrians forced to walk on the road causing safety issues.", "address": "Sadar Bazaar, Old Delhi - 110006", "lat": 28.6517, "lng": 77.2120},
    {"category": "other", "description": "Overhead cable wires hanging dangerously low on the road. Tall vehicles and pedestrians at risk of electric shock.", "address": "SP Mukherjee Road, Hazratganj, Lucknow - 226001", "lat": 26.8467, "lng": 80.9462},
    {"category": "other", "description": "Flooding of basement parking due to blocked storm water drain. Residents' vehicles damaged. Urgent pumping needed.", "address": "Sector 15, Noida - 201301", "lat": 28.5848, "lng": 77.3220},
    {"category": "other", "description": "Abandoned vehicle blocking the narrow lane for 10 days. Fire brigade and ambulance access completely blocked.", "address": "Jangpura Extension, New Delhi - 110014", "lat": 28.5889, "lng": 77.2429},
    {"category": "other", "description": "Unauthorized hoarding blocking traffic signage view at busy intersection. Serious road safety concern.", "address": "MG Road, Aundh, Pune - 411007", "lat": 18.5590, "lng": 73.8076},
    {"category": "other", "description": "Thick cloud of smoke from garbage burning in open area. Air quality severely impacted. Residents suffering respiratory issues.", "address": "Mustafabad, North East Delhi - 110094", "lat": 28.7032, "lng": 77.2722},
    {"category": "other", "description": "Tree fallen across road after storm blocking both lanes. Emergency removal required immediately.", "address": "Lutyens Zone, Central Delhi - 110011", "lat": 28.6158, "lng": 77.2090},
]


def random_past_date(days_back_min: int, days_back_max: int) -> datetime:
    days = random.randint(days_back_min, days_back_max)
    hours = random.randint(6, 22)
    minutes = random.randint(0, 59)
    return datetime.now(timezone.utc) - timedelta(days=days, hours=hours, minutes=minutes)


async def seed():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_default_database(default="civic-issue-reporting")

    try:
        await client.admin.command("ping")
        print("Connected\n")
    except Exception as exc:
        print(f"Cannot connect to MongoDB: {exc}")
        return

    # ── Find or create demo account ──────────────────────────────────────────
    demo_user = await db.users.find_one({"email": DEMO_EMAIL})
    if not demo_user:
        print(f"Demo account not found - creating {DEMO_EMAIL}...")
        hashed = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()
        result = await db.users.insert_one({
            "name": DEMO_NAME,
            "email": DEMO_EMAIL,
            "phone": DEMO_PHONE,
            "password": hashed,
            "role": "CITIZEN",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        })
        demo_user_id = result.inserted_id
        print(f"Demo account created (id: {demo_user_id})\n")
    else:
        demo_user_id = demo_user["_id"]
        print(f"Demo account found (id: {demo_user_id})\n")

    # ── Remove old demo seed complaints for this user ────────────────────────
    deleted = await db.complaints.delete_many({"citizenId": demo_user_id, "isDemo": True})
    if deleted.deleted_count:
        print(f"Removed {deleted.deleted_count} old demo complaints\n")

    # ── Determine next complaint ID ──────────────────────────────────────────
    max_existing = 10000
    cursor = db.complaints.find(
        {"complaintId": {"$regex": r"^CIV-\d+$"}},
        {"complaintId": 1}
    ).sort("complaintId", -1).limit(20)
    existing_list = await cursor.to_list(20)
    for item in existing_list:
        cid = item.get("complaintId", "")
        try:
            num = int(cid.split("-")[1])
            if num > max_existing:
                max_existing = num
        except (IndexError, ValueError):
            pass

    # ── Build 50 complaint documents ─────────────────────────────────────────
    docs = []
    status_cycle = STATUSES * 5  # covers 50 entries

    for i, data in enumerate(COMPLAINTS):
        cat = data["category"]
        status_val = status_cycle[i]

        created_at = random_past_date(2, 180)
        updated_at = created_at + timedelta(hours=random.randint(1, 72))
        if updated_at > datetime.now(timezone.utc):
            updated_at = datetime.now(timezone.utc)

        resolved_at = None
        if status_val == "RESOLVED":
            resolved_at = updated_at + timedelta(hours=random.randint(2, 48))
            if resolved_at > datetime.now(timezone.utc):
                resolved_at = datetime.now(timezone.utc)

        complaint_id = f"CIV-{max_existing + i + 1}"

        lat_jitter = random.uniform(-0.005, 0.005)
        lng_jitter = random.uniform(-0.005, 0.005)

        doc = {
            "complaintId": complaint_id,
            "citizenId": demo_user_id,
            "category": cat,
            "status": status_val,
            "description": data["description"],
            "address": data["address"],
            "latitude": round(data["lat"] + lat_jitter, 6),
            "longitude": round(data["lng"] + lng_jitter, 6),
            "department": DEPARTMENTS[cat],
            "priority": PRIORITIES[cat],
            "images": [],
            "evidenceHashes": [],
            "needsReview": False,
            "reviewFlags": [],
            "imageMetadata": [],
            "metadataChecks": [],
            "isAnonymous": False,
            "reporterName": "",
            "reporterPhone": "",
            "voiceNote": None,
            "upvotes": random.randint(0, 24),
            "upvotedBy": [],
            "upvotedPhones": [],
            "submissionRateKey": str(demo_user_id),
            "createdAt": created_at,
            "updatedAt": updated_at,
            "isDemo": True,
        }

        if resolved_at:
            doc["resolvedAt"] = resolved_at

        docs.append(doc)

    result = await db.complaints.insert_many(docs)
    inserted_count = len(result.inserted_ids)

    # Update counter
    await db.counters.update_one(
        {"_id": "complaintId"},
        {"$max": {"seq": max_existing + inserted_count}},
        upsert=True,
    )

    print(f"Inserted {inserted_count} sample complaints for {DEMO_EMAIL}")
    print(f"ID range: CIV-{max_existing + 1}  to  CIV-{max_existing + inserted_count}")
    print(f"\nLogin credentials:")
    print(f"  Email   : {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
