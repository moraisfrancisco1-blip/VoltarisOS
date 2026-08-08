"""
cache.py — Redis cache and session management module.

Provides:
- Redis client initialization (with fallback to in-memory cache)
- Session storage for user sessions
- Short-term data caching
- Rate limiting support

Usage:
    from backend.cache import cache
    
    # Set a value
    cache.set("key", "value", ttl=300)
    
    # Get a value
    value = cache.get("key")
    
    # Delete a value
    cache.delete("key")
"""
import os
import json
import time
from typing import Optional, Any


class InMemoryCache:
    """Fallback in-memory cache when Redis is not available."""
    
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        if key in self._store:
            value, expires_at = self._store[key]
            if expires_at > time.time():
                return value
            else:
                del self._store[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set a value in cache with TTL (seconds)."""
        expires_at = time.time() + ttl
        self._store[key] = (value, expires_at)
        return True
    
    def delete(self, key: str) -> bool:
        """Delete a value from cache."""
        if key in self._store:
            del self._store[key]
            return True
        return False
    
    def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        if key in self._store:
            _, expires_at = self._store[key]
            if expires_at > time.time():
                return True
            else:
                del self._store[key]
        return False
    
    def clear(self) -> bool:
        """Clear all cache entries."""
        self._store.clear()
        return True


class RedisCache:
    """Redis-based cache with connection pooling."""
    
    def __init__(self, redis_url: str):
        self._redis = None
        self._redis_url = redis_url
        self._connect()
    
    def _connect(self):
        """Establish Redis connection."""
        try:
            import redis
            self._redis = redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Test connection
            self._redis.ping()
        except Exception as e:
            print(f"WARNING: Redis connection failed: {e}. Falling back to in-memory cache.")
            self._redis = None
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        if self._redis is None:
            return False
        try:
            self._redis.ping()
            return True
        except Exception:
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        if not self.is_connected:
            return None
        try:
            value = self._redis.get(key)
            if value:
                return json.loads(value)
        except Exception:
            pass
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set a value in cache with TTL (seconds)."""
        if not self.is_connected:
            return False
        try:
            serialized = json.dumps(value)
            return self._redis.setex(key, ttl, serialized)
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a value from cache."""
        if not self.is_connected:
            return False
        try:
            return self._redis.delete(key) > 0
        except Exception:
            return False
    
    def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        if not self.is_connected:
            return False
        try:
            return self._redis.exists(key) > 0
        except Exception:
            return False
    
    def clear(self) -> bool:
        """Clear all cache entries (use with caution!)."""
        if not self.is_connected:
            return False
        try:
            # Only clear keys with our prefix
            keys = self._redis.keys("voltaris:*")
            if keys:
                self._redis.delete(*keys)
            return True
        except Exception:
            return False


class CacheManager:
    """Unified cache manager with Redis/in-memory fallback."""
    
    def __init__(self):
        self._cache = None
        self._initialize()
    
    def _initialize(self):
        """Initialize cache backend."""
        redis_url = os.getenv("REDIS_URL", "")
        
        if redis_url:
            self._cache = RedisCache(redis_url)
            if self._cache.is_connected:
                print("✓ Redis cache connected")
            else:
                print("⚠ Redis unavailable, using in-memory cache")
                self._cache = InMemoryCache()
        else:
            self._cache = InMemoryCache()
            print("ℹ Using in-memory cache (set REDIS_URL for Redis)")
    
    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        return self._cache.get(key)
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set a value in cache with TTL (seconds)."""
        return self._cache.set(key, value, ttl)
    
    def delete(self, key: str) -> bool:
        """Delete a value from cache."""
        return self._cache.delete(key)
    
    def exists(self, key: str) -> bool:
        """Check if a key exists in cache."""
        return self._cache.exists(key)
    
    def clear(self) -> bool:
        """Clear all cache entries."""
        return self._cache.clear()
    
    # ─── Session Management ──────────────────────────────────────────────────
    
    def set_session(self, session_id: str, user_data: dict, ttl: int = 3600) -> bool:
        """Store user session data."""
        key = f"voltaris:session:{session_id}"
        return self.set(key, user_data, ttl)
    
    def get_session(self, session_id: str) -> Optional[dict]:
        """Retrieve user session data."""
        key = f"voltaris:session:{session_id}"
        return self.get(key)
    
    def delete_session(self, session_id: str) -> bool:
        """Delete user session."""
        key = f"voltaris:session:{session_id}"
        return self.delete(key)
    
    # ─── Rate Limiting ───────────────────────────────────────────────────────
    
    def increment_rate_limit(self, key: str, ttl: int = 60) -> int:
        """Increment rate limit counter and return current count."""
        full_key = f"voltaris:ratelimit:{key}"
        
        if isinstance(self._cache, RedisCache) and self._cache.is_connected:
            try:
                pipe = self._cache._redis.pipeline()
                pipe.incr(full_key)
                pipe.expire(full_key, ttl)
                results = pipe.execute()
                return results[0]
            except Exception:
                pass
        
        # Fallback to in-memory
        current = self.get(full_key) or 0
        self.set(full_key, current + 1, ttl)
        return current + 1


# Global cache instance
cache = CacheManager()