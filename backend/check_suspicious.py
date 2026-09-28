import asyncio
from app.database.mongodb import get_database, connect_to_mongo

async def main():
    await connect_to_mongo()
    db = get_database()
    items = await db.complaints.find({'isSuspicious': True}).to_list(None)
    print(f'Total Suspicious: {len(items)}')
    for x in items:
        print(f"  {x['complaintId']} | {x['category']} | {x['district_name']} | Score: {round(x['suspiciousScore']*100)}%")

if __name__ == '__main__':
    asyncio.run(main())
