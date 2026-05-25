"""
NoSQL Database Adapters
Support for MongoDB, Redis, Elasticsearch, and other NoSQL databases
"""

from .base_adapter import BaseNoSQLAdapter, DatabaseInfo, QueryResult
from .mongodb_adapter import MongoDBAdapter
from .redis_adapter import RedisAdapter
from .elasticsearch_adapter import ElasticsearchAdapter
from .cassandra_adapter import CassandraAdapter
from .adapter_factory import NoSQLAdapterFactory

__all__ = [
    'BaseNoSQLAdapter',
    'DatabaseInfo', 
    'QueryResult',
    'MongoDBAdapter',
    'RedisAdapter',
    'ElasticsearchAdapter',
    'CassandraAdapter',
    'NoSQLAdapterFactory'
]