defmodule ClawPipe.ClientTest do
  use ExUnit.Case

  alias ClawPipe.{Cache, Client}

  setup do
    Cache.clear()
    :ok
  end

  # ---------------------------------------------------------------------------
  # Boosted responses (no HTTP needed)
  # ---------------------------------------------------------------------------

  describe "prompt/2 — booster short-circuits" do
    test "returns boosted result for math prompt" do
      assert {:ok, result} = Client.prompt("what is 2 + 2", api_key: "cp_test")
      assert result.text    == "4"
      assert result.boosted == true
      assert result.cached  == false
    end

    test "boosted result has 100% savings_pct" do
      {:ok, result} = Client.prompt("what is 3 * 3", api_key: "cp_test")
      assert result.savings_pct == 100.0
    end

    test "uuid rule triggers the booster" do
      {:ok, result} = Client.prompt("generate a uuid", api_key: "cp_test")
      assert result.boosted == true
      assert String.length(result.text) == 36
    end

    test "date rule triggers the booster" do
      {:ok, result} = Client.prompt("what is today", api_key: "cp_test")
      assert result.boosted == true
      assert Regex.match?(~r/^\d{4}-\d{2}-\d{2}$/, result.text)
    end

    test "skip_boost bypasses the booster and hits cache miss" do
      # Without a real gateway we expect {:error, _} — NOT a boosted result
      result = Client.prompt("what is 2 + 2", api_key: "cp_test", skip_boost: true, base_url: "http://localhost:9999")
      assert match?({:error, _}, result)
    end
  end

  # ---------------------------------------------------------------------------
  # Cache hit path (inject a cached response)
  # ---------------------------------------------------------------------------

  describe "prompt/2 — cache hit" do
    test "returns cached value without hitting gateway" do
      prompt   = "what is the airspeed velocity of an unladen swallow"
      response = "African or European?"

      # Pre-seed the cache — pack the prompt first as the client would
      packed = ClawPipe.Packer.pack(prompt)
      Cache.set(packed.text, response)

      {:ok, result} = Client.prompt(prompt, api_key: "cp_test")

      assert result.text   == response
      assert result.cached == true
    end

    test "skip_cache bypasses cache lookup" do
      prompt   = "a uniquely cached prompt #{System.unique_integer()}"
      packed   = ClawPipe.Packer.pack(prompt)
      Cache.set(packed.text, "cached value")

      # With skip_cache: true the cache is ignored → gateway call → error
      result = Client.prompt(prompt, api_key: "cp_test", skip_cache: true, base_url: "http://localhost:9999")
      assert match?({:error, _}, result)
    end
  end

  # ---------------------------------------------------------------------------
  # Gateway path (Bypass integration)
  # ---------------------------------------------------------------------------

  describe "prompt/2 — gateway call via Bypass" do
    setup do
      bypass = Bypass.open()
      {:ok, bypass: bypass}
    end

    test "successful gateway response is returned", %{bypass: bypass} do
      Bypass.expect_once(bypass, "POST", "/v1/prompt", fn conn ->
        body = Jason.encode!(%{text: "Paris", provider: "openai", model: "gpt-4o-mini", cached: false, boosted: false})
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.send_resp(200, body)
      end)

      base_url = "http://localhost:#{bypass.port}/v1"
      prompt   = "What is the capital of France? #{System.unique_integer()}"

      assert {:ok, result} = Client.prompt(prompt, api_key: "cp_test", base_url: base_url)
      assert result.text    == "Paris"
      assert result.boosted == false
      assert result.cached  == false
    end

    test "gateway 4xx returns {:error, _}", %{bypass: bypass} do
      Bypass.expect_once(bypass, "POST", "/v1/prompt", fn conn ->
        Plug.Conn.send_resp(conn, 401, ~s|{"message":"Unauthorized"}|)
      end)

      base_url = "http://localhost:#{bypass.port}/v1"
      prompt   = "Unauthorized prompt #{System.unique_integer()}"

      assert {:error, %{status: 401}} = Client.prompt(prompt, api_key: "bad_key", base_url: base_url)
    end

    test "gateway response is cached for the next call", %{bypass: bypass} do
      Bypass.expect_once(bypass, "POST", "/v1/prompt", fn conn ->
        body = Jason.encode!(%{text: "42", provider: "openai", model: "gpt-4o-mini"})
        conn
        |> Plug.Conn.put_resp_content_type("application/json")
        |> Plug.Conn.send_resp(200, body)
      end)

      base_url = "http://localhost:#{bypass.port}/v1"
      prompt   = "Cacheable prompt #{System.unique_integer()}"

      # First call — goes to gateway
      {:ok, r1} = Client.prompt(prompt, api_key: "cp_test", base_url: base_url, skip_boost: true)
      assert r1.cached == false

      # Second call — should come from cache (Bypass would error if called twice)
      {:ok, r2} = Client.prompt(prompt, api_key: "cp_test", base_url: base_url, skip_boost: true)
      assert r2.cached == true
      assert r2.text   == "42"
    end
  end

  # ---------------------------------------------------------------------------
  # api_key is required
  # ---------------------------------------------------------------------------

  describe "prompt/2 — validation" do
    test "raises KeyError when api_key is missing" do
      assert_raise KeyError, fn ->
        Client.prompt("hello", provider: "openai")
      end
    end
  end
end
