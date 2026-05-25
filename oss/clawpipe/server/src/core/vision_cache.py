"""
FinSavvyAI Vision Cache

SQLite-backed cache for vision API results with TTL expiration.

Schema and hashing live in vision_cache_schema.py.
"""

import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

from src.core.vision_cache_schema import (
    CREATE_INDEX_SQL,
    CREATE_TABLE_SQL,
    hash_image,
    hash_prompt,
)

logger = logging.getLogger("finsavvyai.vision_cache")


class VisionCache:
    """SQLite-backed cache for vision API results."""

    def __init__(self, db_path: Optional[str] = None, ttl: int = 3600):
        if db_path is None:
            cache_dir = Path.home() / ".finsavvyai"
            cache_dir.mkdir(parents=True, exist_ok=True)
            db_path = str(cache_dir / "vision_cache.db")
        self.db_path = db_path
        self.ttl = ttl
        self._initialized = False
        self._hits = 0
        self._misses = 0

    async def init_db(self) -> None:
        """Create tables and indexes if they don't exist."""
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute(CREATE_TABLE_SQL)
            await db.execute(CREATE_INDEX_SQL)
            await db.commit()
        self._initialized = True
        logger.info("Vision cache initialized at %s", self.db_path)

    async def get(self, image_data: str, model: str,
                  messages: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Look up cached vision result. Returns None on miss/expiry."""
        await self.init_db()
        img_hash = hash_image(image_data)
        p_hash = hash_prompt(messages)
        now = time.time()
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(
                    "SELECT id, response, created_at, access_count FROM vision_cache "
                    "WHERE image_hash = ? AND model = ? AND prompt_hash = ?",
                    (img_hash, model, p_hash))
                row = await cursor.fetchone()
                if row is None:
                    self._misses += 1
                    return None
                age = now - row["created_at"]
                if age > self.ttl:
                    await db.execute("DELETE FROM vision_cache WHERE id = ?", (row["id"],))
                    await db.commit()
                    self._misses += 1
                    return None
                await db.execute("UPDATE vision_cache SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?",
                                 (now, row["id"]))
                await db.commit()
                self._hits += 1
                return {"text": json.loads(row["response"]), "cached": True,
                        "cache_age": round(age, 1), "access_count": row["access_count"] + 1}
        except Exception as e:
            logger.warning("Cache get failed: %s", e)
            self._misses += 1
            return None

    async def set(self, image_data: str, model: str,
                  messages: List[Dict[str, Any]], response: Any) -> None:
        """Store a vision result in the cache."""
        await self.init_db()
        img_hash = hash_image(image_data)
        p_hash = hash_prompt(messages)
        now = time.time()
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("DELETE FROM vision_cache WHERE image_hash = ? AND model = ? AND prompt_hash = ?",
                                 (img_hash, model, p_hash))
                await db.execute(
                    "INSERT INTO vision_cache (image_hash, model, prompt_hash, response, created_at, accessed_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)", (img_hash, model, p_hash, json.dumps(response), now, now))
                await db.commit()
        except Exception as e:
            logger.warning("Cache set failed: %s", e)

    async def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns number removed."""
        await self.init_db()
        cutoff = time.time() - self.ttl
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute("DELETE FROM vision_cache WHERE created_at < ?", (cutoff,))
                await db.commit()
                removed = cursor.rowcount
                if removed:
                    logger.info("Cache cleanup: removed %d expired entries", removed)
                return removed
        except Exception as e:
            logger.warning("Cache cleanup failed: %s", e)
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        await self.init_db()
        total = self._hits + self._misses
        hit_rate = (self._hits / total) if total > 0 else 0.0
        try:
            async with aiosqlite.connect(self.db_path) as db:
                row = await (await db.execute("SELECT COUNT(*) FROM vision_cache")).fetchone()
                entry_count = row[0] if row else 0
                row = await (await db.execute("SELECT SUM(LENGTH(response)) FROM vision_cache")).fetchone()
                size_bytes = row[0] or 0
            return {"total_entries": entry_count, "hits": self._hits, "misses": self._misses,
                    "hit_rate": round(hit_rate, 4), "size_bytes": size_bytes}
        except Exception as e:
            logger.warning("Cache stats failed: %s", e)
            return {"total_entries": 0, "hits": self._hits, "misses": self._misses,
                    "hit_rate": round(hit_rate, 4), "size_bytes": 0}

    async def clear(self) -> None:
        """Delete all cached entries."""
        await self.init_db()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM vision_cache")
            await db.commit()
        self._hits = 0
        self._misses = 0
        logger.info("Vision cache cleared")

    async def close(self) -> None:
        """Cleanup (no persistent connection to close with aiosqlite)."""
        pass

    # Keep static method aliases for backward compatibility
    _hash_image = staticmethod(hash_image)
    _hash_prompt = staticmethod(hash_prompt)
