//! ReasoningBank Cache -- client-side in-memory prompt cache.
//!
//! Hash-based dedup with TTL expiry and LRU eviction.
//! Thread-safe via `Arc<RwLock<>>`.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Instant;

#[derive(Debug, Clone)]
struct CacheEntry {
    value: String,
    created_at: Instant,
    hits: u64,
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub size: usize,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: String,
    pub total_saved: u64,
}

/// Thread-safe prompt cache with TTL and LRU eviction.
#[derive(Clone)]
pub struct Cache {
    inner: Arc<RwLock<CacheInner>>,
}

struct CacheInner {
    store: HashMap<String, CacheEntry>,
    ttl_ms: u64,
    max_entries: usize,
    total_hits: u64,
    total_misses: u64,
    #[allow(dead_code)]
    start: Instant,
}

impl Cache {
    pub fn new(ttl_ms: u64, max_entries: usize) -> Self {
        Self {
            inner: Arc::new(RwLock::new(CacheInner {
                store: HashMap::new(),
                ttl_ms,
                max_entries,
                total_hits: 0,
                total_misses: 0,
                start: Instant::now(),
            })),
        }
    }

    /// Generate a cache key from prompt and options JSON.
    pub fn key(&self, prompt: &str, options: &str) -> String {
        let raw = format!(r#"{{"prompt":"{prompt}","options":{options}}}"#);
        let hash = djb2_hash(&raw);
        format!("cp_{hash}")
    }

    /// Get a cached value. Returns `None` if missing or expired.
    pub fn get(&self, cache_key: &str) -> Option<String> {
        let mut inner = self.inner.write().unwrap();
        let ttl_ms = inner.ttl_ms;
        // Check existence and expiry first
        let status = match inner.store.get(cache_key) {
            None => 0,          // missing
            Some(e) if e.created_at.elapsed().as_millis() as u64 > ttl_ms => 1, // expired
            Some(_) => 2,       // valid
        };
        match status {
            0 => { inner.total_misses += 1; None }
            1 => {
                inner.store.remove(cache_key);
                inner.total_misses += 1;
                None
            }
            _ => {
                let entry = inner.store.get_mut(cache_key).unwrap();
                entry.hits += 1;
                let value = entry.value.clone();
                inner.total_hits += 1;
                Some(value)
            }
        }
    }

    /// Store a value in cache.
    pub fn set(&self, cache_key: &str, value: &str) {
        let mut inner = self.inner.write().unwrap();
        evict_if_full(&mut inner);
        inner.store.insert(
            cache_key.to_string(),
            CacheEntry {
                value: value.to_string(),
                created_at: Instant::now(),
                hits: 0,
            },
        );
    }

    /// Check if a key exists and is not expired.
    pub fn has(&self, cache_key: &str) -> bool {
        let mut inner = self.inner.write().unwrap();
        let ttl_ms = inner.ttl_ms;
        if let Some(entry) = inner.store.get(cache_key) {
            if entry.created_at.elapsed().as_millis() as u64 > ttl_ms {
                inner.store.remove(cache_key);
                return false;
            }
            return true;
        }
        false
    }

    /// Remove a specific entry.
    pub fn delete(&self, cache_key: &str) -> bool {
        self.inner.write().unwrap().store.remove(cache_key).is_some()
    }

    /// Clear all cached entries.
    pub fn clear(&self) {
        let mut inner = self.inner.write().unwrap();
        inner.store.clear();
        inner.total_hits = 0;
        inner.total_misses = 0;
    }

    /// Get cache performance stats.
    pub fn stats(&self) -> CacheStats {
        let inner = self.inner.read().unwrap();
        let total = inner.total_hits + inner.total_misses;
        let hit_rate = if total > 0 {
            format!("{:.1}%", inner.total_hits as f64 / total as f64 * 100.0)
        } else {
            "0.0%".to_string()
        };
        CacheStats {
            size: inner.store.len(),
            hits: inner.total_hits,
            misses: inner.total_misses,
            hit_rate,
            total_saved: inner.total_hits,
        }
    }

    /// Remove expired entries.
    pub fn prune(&self) -> usize {
        let mut inner = self.inner.write().unwrap();
        let ttl_ms = inner.ttl_ms;
        let before = inner.store.len();
        inner.store.retain(|_, entry| {
            entry.created_at.elapsed().as_millis() as u64 <= ttl_ms
        });
        before - inner.store.len()
    }
}

fn evict_if_full(inner: &mut CacheInner) {
    if inner.store.len() < inner.max_entries {
        return;
    }
    let to_remove = (inner.max_entries as f64 * 0.1).ceil() as usize;
    let mut entries: Vec<(String, u64)> = inner
        .store.iter().map(|(k, v)| (k.clone(), v.hits)).collect();
    entries.sort_by_key(|(_, hits)| *hits);
    for (key, _) in entries.into_iter().take(to_remove) {
        inner.store.remove(&key);
    }
}

fn djb2_hash(input: &str) -> String {
    let mut hash: u32 = 5381;
    for byte in input.bytes() {
        hash = hash.wrapping_shl(5).wrapping_add(hash).wrapping_add(byte as u32);
    }
    format!("{}", radix36(hash))
}

fn radix36(mut n: u32) -> String {
    if n == 0 { return "0".to_string(); }
    let chars = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut result = Vec::new();
    while n > 0 {
        result.push(chars[(n % 36) as usize]);
        n /= 36;
    }
    result.reverse();
    String::from_utf8(result).unwrap()
}
