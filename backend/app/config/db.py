from motor.motor_asyncio import AsyncIOMotorClient
from .env import env

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(env.MONGODB_URI, serverSelectionTimeoutMS=5000)
    # Use the database encoded in either a local or Atlas URI, falling back to
    # the application name when the URI does not specify one.
    db_instance.db = db_instance.client.get_default_database(default="civic-issue-reporting")
    await db_instance.client.admin.command("ping")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()

def get_db():
    return db_instance.db

get_database = get_db
