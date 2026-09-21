from ..config.db import get_db
from pymongo import ReturnDocument

async def get_next_complaint_id() -> str:
    db = get_db()
    
    # 1. Determine highest existing complaintId number in the collection
    max_existing = 10000
    cursor = db.complaints.find(
        {"complaintId": {"$regex": r"^CIV-\d+$"}},
        {"complaintId": 1}
    ).sort("complaintId", -1).limit(10)
    
    existing_list = await cursor.to_list(10)
    for item in existing_list:
        cid = item.get("complaintId", "")
        try:
            num = int(cid.split("-")[1])
            if num > max_existing:
                max_existing = num
        except (IndexError, ValueError):
            pass

    # 2. Ensure the counter document is at least as high as max_existing
    await db.counters.update_one(
        {"_id": "complaintId"},
        {"$max": {"seq": max_existing}},
        upsert=True
    )

    # 3. Increment atomically
    counter = await db.counters.find_one_and_update(
        {"_id": "complaintId"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    seq = counter.get("seq", max_existing + 1)
    
    # 4. Extra safety: ensure this ID does not collide with an existing one
    candidate = f"CIV-{seq}"
    while await db.complaints.find_one({"complaintId": candidate}):
        counter = await db.counters.find_one_and_update(
            {"_id": "complaintId"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        seq = counter.get("seq", seq + 1)
        candidate = f"CIV-{seq}"

    return candidate
