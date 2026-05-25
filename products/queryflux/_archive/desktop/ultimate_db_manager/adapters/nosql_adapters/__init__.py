"""
NoSQL Database Adapters
Support for MongoDB, Redis, and other NoSQL databases
"""

from .mongodb_adapter import MongoDBAdapter
from .redis_adapter import RedisAdapter

__all__ = [
    'MongoDBAdapter',
    'RedisAdapter'
]