from pymongo import MongoClient
from pymongo.errors import PyMongoError
from config import get_settings

settings = get_settings()
client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
db = client.cloudlane


def ping_database() -> bool:
    try:
        client.admin.command('ping')
        return True
    except PyMongoError:
        return False
