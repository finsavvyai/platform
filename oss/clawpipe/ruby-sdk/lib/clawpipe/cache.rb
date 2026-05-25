# frozen_string_literal: true

require 'digest'
require 'json'

module ClawPipe
  CacheEntry = Struct.new(:value, :created_at, :hits, keyword_init: true)
  CacheStats = Struct.new(:size, :hits, :misses, :hit_rate, :total_saved, keyword_init: true)

  # In-memory prompt cache with TTL and LRU-style eviction.
  # Keys are SHA-256 digests of the serialized prompt + options.
  class Cache
    DEFAULT_TTL = 300   # seconds
    MAX_ENTRIES = 10_000

    def initialize(ttl: DEFAULT_TTL, max_entries: MAX_ENTRIES)
      @store = {}
      @ttl = ttl
      @max_entries = max_entries
      @total_hits = 0
      @total_misses = 0
    end

    # Build a cache key from a prompt and optional options hash.
    def key(prompt, options = {})
      raw = JSON.generate({ prompt: prompt, options: options || {} }.sort.to_h)
      Digest::SHA256.hexdigest(raw)
    end

    # Return cached value or nil if missing/expired.
    def get(cache_key)
      entry = @store[cache_key]
      unless entry
        @total_misses += 1
        return nil
      end

      if (Time.now - entry.created_at) > @ttl
        @store.delete(cache_key)
        @total_misses += 1
        return nil
      end

      entry.hits += 1
      @total_hits += 1
      entry.value
    end

    # Store a value in the cache.
    def set(cache_key, value)
      evict_if_full
      @store[cache_key] = CacheEntry.new(value: value, created_at: Time.now, hits: 0)
    end

    def has?(cache_key)
      entry = @store[cache_key]
      return false unless entry

      if (Time.now - entry.created_at) > @ttl
        @store.delete(cache_key)
        return false
      end
      true
    end

    def delete(cache_key)
      @store.delete(cache_key) ? true : false
    end

    def clear
      @store.clear
      @total_hits = 0
      @total_misses = 0
    end

    def stats
      total = @total_hits + @total_misses
      rate = total > 0 ? format('%.1f%%', (@total_hits.to_f / total) * 100) : '0.0%'
      CacheStats.new(
        size: @store.size,
        hits: @total_hits,
        misses: @total_misses,
        hit_rate: rate,
        total_saved: @total_hits
      )
    end

    # Remove expired entries, return count removed.
    def prune
      now = Time.now
      expired = @store.select { |_k, entry| (now - entry.created_at) > @ttl }.keys
      expired.each { |k| @store.delete(k) }
      expired.size
    end

    private

    def evict_if_full
      return if @store.size < @max_entries

      to_remove = (@max_entries * 0.1).ceil
      @store.sort_by { |_k, entry| entry.hits }.first(to_remove).each { |k, _| @store.delete(k) }
    end
  end
end
