"""MongoDB connection and collection accessors using Motor (async) and PyMongo (sync)."""
import logging
from motor.motor_asyncio import AsyncIOMotorClient
import pymongo

from . import config

logger = logging.getLogger("saath.mongo")

_async_client: AsyncIOMotorClient | None = None
_sync_client: pymongo.MongoClient | None = None


def get_async_client() -> AsyncIOMotorClient:
    global _async_client
    if _async_client is None:
        _async_client = AsyncIOMotorClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    return _async_client


def get_sync_client() -> pymongo.MongoClient:
    global _sync_client
    if _sync_client is None:
        _sync_client = pymongo.MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=5000)
    return _sync_client


def get_db():
    return get_async_client()[config.MONGO_DB_NAME]


def get_sync_db():
    return get_sync_client()[config.MONGO_DB_NAME]


# Primary Async Collections
def get_users_col():
    return get_db()["users"]


def get_otp_col():
    return get_db()["otp_requests"]


def get_tokens_col():
    return get_db()["auth_tokens"]


# Primary Sync Collections (for migration and sync scripts)
def get_sync_users_col():
    return get_sync_db()["users"]


def get_sync_otp_col():
    return get_sync_db()["otp_requests"]


def get_sync_tokens_col():
    return get_sync_db()["auth_tokens"]


async def init_mongo_indexes():
    """Create required indexes for users, otp_requests, and auth_tokens."""
    db = get_db()
    users_col = db["users"]
    otp_col = db["otp_requests"]
    tokens_col = db["auth_tokens"]

    # users: unique index on normalized_email, index on role
    await users_col.create_index([("normalized_email", pymongo.ASCENDING)], unique=True)
    await users_col.create_index([("role", pymongo.ASCENDING)])

    # otp_requests: TTL index on expires_at, compound index on email + purpose
    await otp_col.create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)
    await otp_col.create_index([("email", pymongo.ASCENDING), ("purpose", pymongo.ASCENDING)])

    # auth_tokens: unique index on token, index on user_id, TTL on expires_at
    await tokens_col.create_index([("token", pymongo.ASCENDING)], unique=True)
    await tokens_col.create_index([("user_id", pymongo.ASCENDING)])
    await tokens_col.create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)

    logger.info("MongoDB indexes verified.")


def init_sync_indexes():
    """Synchronous version for migrations and CLI tools."""
    db = get_sync_db()
    db["users"].create_index([("normalized_email", pymongo.ASCENDING)], unique=True)
    db["users"].create_index([("role", pymongo.ASCENDING)])
    db["otp_requests"].create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)
    db["otp_requests"].create_index([("email", pymongo.ASCENDING), ("purpose", pymongo.ASCENDING)])
    db["auth_tokens"].create_index([("token", pymongo.ASCENDING)], unique=True)
    db["auth_tokens"].create_index([("user_id", pymongo.ASCENDING)])
    db["auth_tokens"].create_index([("expires_at", pymongo.ASCENDING)], expireAfterSeconds=0)
