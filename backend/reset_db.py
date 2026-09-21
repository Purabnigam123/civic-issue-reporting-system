#!/usr/bin/env python3
"""Reset the database for testing"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def reset_db():
    client = AsyncIOMotorClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
    db = client.get_database("civic-issue-reporting")
    
    try:
        # Clear users collection
        result = await db.users.delete_many({})
        print(f"✓ Deleted {result.deleted_count} users")
        
        # Clear complaints collection
        result = await db.complaints.delete_many({})
        print(f"✓ Deleted {result.deleted_count} complaints")
        
        # Reset counter if it exists
        result = await db.counters.delete_many({})
        print(f"✓ Deleted {result.deleted_count} counters")
        
        print("\n✓ Database reset successfully!")
        return True
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    success = asyncio.run(reset_db())
    exit(0 if success else 1)
