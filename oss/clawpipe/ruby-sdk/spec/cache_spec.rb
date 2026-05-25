# frozen_string_literal: true

require_relative '../lib/clawpipe/cache'

RSpec.describe ClawPipe::Cache do
  subject(:cache) { described_class.new(ttl: 60) }

  describe '#key' do
    it 'returns a consistent hex string for the same inputs' do
      k1 = cache.key('hello', {})
      k2 = cache.key('hello', {})
      expect(k1).to eq(k2)
    end

    it 'returns different keys for different prompts' do
      expect(cache.key('hello')).not_to eq(cache.key('world'))
    end

    it 'returns a 64-char SHA-256 hex string' do
      expect(cache.key('test')).to match(/\A[0-9a-f]{64}\z/)
    end
  end

  describe '#set / #get' do
    it 'stores and retrieves a value' do
      k = cache.key('prompt')
      cache.set(k, 'response')
      expect(cache.get(k)).to eq('response')
    end

    it 'returns nil for a missing key' do
      expect(cache.get('nonexistent')).to be_nil
    end

    it 'returns nil for an expired entry' do
      short_cache = described_class.new(ttl: 0)
      k = short_cache.key('p')
      short_cache.set(k, 'val')
      sleep(0.01)
      expect(short_cache.get(k)).to be_nil
    end

    it 'increments hit count on each get' do
      k = cache.key('x')
      cache.set(k, 'v')
      cache.get(k)
      cache.get(k)
      expect(cache.stats.hits).to eq(2)
    end
  end

  describe '#has?' do
    it 'returns true for a present key' do
      k = cache.key('a')
      cache.set(k, 'b')
      expect(cache.has?(k)).to be true
    end

    it 'returns false for a missing key' do
      expect(cache.has?('missing')).to be false
    end
  end

  describe '#delete' do
    it 'removes an existing key and returns true' do
      k = cache.key('del')
      cache.set(k, 'v')
      expect(cache.delete(k)).to be true
      expect(cache.get(k)).to be_nil
    end

    it 'returns false for a non-existent key' do
      expect(cache.delete('ghost')).to be false
    end
  end

  describe '#clear' do
    it 'removes all entries and resets counters' do
      cache.set(cache.key('a'), 'va')
      cache.set(cache.key('b'), 'vb')
      cache.get(cache.key('a'))
      cache.clear
      expect(cache.stats.size).to eq(0)
      expect(cache.stats.hits).to eq(0)
    end
  end

  describe '#stats' do
    it 'tracks hits and misses accurately' do
      k = cache.key('stat')
      cache.set(k, 'v')
      cache.get(k)         # hit
      cache.get('bad_key') # miss
      s = cache.stats
      expect(s.hits).to eq(1)
      expect(s.misses).to eq(1)
      expect(s.hit_rate).to eq('50.0%')
    end
  end

  describe '#prune' do
    it 'removes expired entries' do
      short_cache = described_class.new(ttl: 0)
      short_cache.set(short_cache.key('p1'), 'v1')
      short_cache.set(short_cache.key('p2'), 'v2')
      sleep(0.01)
      count = short_cache.prune
      expect(count).to eq(2)
      expect(short_cache.stats.size).to eq(0)
    end
  end
end
