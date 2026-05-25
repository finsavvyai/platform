defmodule ClawPipe.CacheTest do
  use ExUnit.Case

  alias ClawPipe.Cache

  setup do
    Cache.clear()
    :ok
  end

  # ---------------------------------------------------------------------------
  # get / set
  # ---------------------------------------------------------------------------

  describe "set/3 and get/1" do
    test "returns :miss for an unknown prompt" do
      assert :miss = Cache.get("unknown prompt #{System.unique_integer()}")
    end

    test "returns cached value immediately after set" do
      prompt = "test prompt #{System.unique_integer()}"
      Cache.set(prompt, "result")
      assert {:ok, "result"} = Cache.get(prompt)
    end

    test "different prompts have independent cache entries" do
      p1 = "prompt one #{System.unique_integer()}"
      p2 = "prompt two #{System.unique_integer()}"
      Cache.set(p1, "one")
      Cache.set(p2, "two")
      assert {:ok, "one"} = Cache.get(p1)
      assert {:ok, "two"} = Cache.get(p2)
    end

    test "overwriting a key stores the new value" do
      prompt = "overwrite me #{System.unique_integer()}"
      Cache.set(prompt, "old")
      Cache.set(prompt, "new")
      assert {:ok, "new"} = Cache.get(prompt)
    end
  end

  # ---------------------------------------------------------------------------
  # TTL
  # ---------------------------------------------------------------------------

  describe "TTL expiry" do
    test "expired entry returns :miss" do
      prompt = "ttl test #{System.unique_integer()}"
      # Set with 0-second TTL — expires immediately
      Cache.set(prompt, "value", 0)
      # Sleep just enough for the second to roll over
      Process.sleep(1100)
      assert :miss = Cache.get(prompt)
    end

    test "entry within TTL returns the value" do
      prompt = "within ttl #{System.unique_integer()}"
      Cache.set(prompt, "fresh", 300)
      assert {:ok, "fresh"} = Cache.get(prompt)
    end
  end

  # ---------------------------------------------------------------------------
  # delete / clear
  # ---------------------------------------------------------------------------

  describe "delete/1" do
    test "removes the entry" do
      prompt = "delete me #{System.unique_integer()}"
      Cache.set(prompt, "bye")
      Cache.delete(prompt)
      assert :miss = Cache.get(prompt)
    end

    test "is idempotent for unknown keys" do
      assert :ok = Cache.delete("never set #{System.unique_integer()}")
    end
  end

  describe "clear/0" do
    test "removes all entries" do
      p1 = "clear test 1 #{System.unique_integer()}"
      p2 = "clear test 2 #{System.unique_integer()}"
      Cache.set(p1, "a")
      Cache.set(p2, "b")
      Cache.clear()
      assert :miss = Cache.get(p1)
      assert :miss = Cache.get(p2)
    end
  end

  # ---------------------------------------------------------------------------
  # Stats
  # ---------------------------------------------------------------------------

  describe "stats/0" do
    test "tracks hits and misses" do
      Cache.clear()
      prompt = "stats prompt #{System.unique_integer()}"
      Cache.get(prompt)                   # miss
      Cache.set(prompt, "value")
      Cache.get(prompt)                   # hit

      stats = Cache.stats()
      assert stats.hits   >= 1
      assert stats.misses >= 1
    end

    test "hit_rate is a percentage string" do
      stats = Cache.stats()
      assert String.ends_with?(stats.hit_rate, "%")
    end
  end

  # ---------------------------------------------------------------------------
  # cache_key/1
  # ---------------------------------------------------------------------------

  describe "cache_key/1" do
    test "same prompt produces the same key" do
      assert Cache.cache_key("hello") == Cache.cache_key("hello")
    end

    test "different prompts produce different keys" do
      refute Cache.cache_key("foo") == Cache.cache_key("bar")
    end

    test "key is a 64-character hex string (SHA-256)" do
      key = Cache.cache_key("anything")
      assert Regex.match?(~r/^[0-9a-f]{64}$/, key)
    end
  end
end
