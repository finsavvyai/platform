defmodule ClawPipe.Client do
  @moduledoc """
  Main entry point for the ClawPipe pipeline.

  Runs: Booster → Packer → Cache → Gateway

      {:ok, result} = ClawPipe.Client.prompt("What is 2 + 2?", api_key: "cp_xxx")
      IO.puts result.text    # "4"
      IO.puts result.boosted # true
  """

  alias ClawPipe.{Booster, Cache, Gateway, Packer}

  @type result :: %{
    text:     String.t(),
    boosted:  boolean(),
    cached:   boolean(),
    provider: String.t() | nil,
    model:    String.t() | nil,
    savings_pct: float()
  }

  @doc """
  Run a prompt through the full ClawPipe pipeline.

  ## Options
    - `:api_key`    — **(required)** your ClawPipe API key
    - `:provider`   — LLM provider override (default: `"openai"`)
    - `:model`      — model override (default: `"gpt-4o-mini"`)
    - `:ttl`        — cache TTL in seconds (default: 300)
    - `:base_url`   — gateway base URL override (useful in tests)
    - `:skip_cache` — set `true` to bypass cache lookup/store
    - `:skip_boost` — set `true` to bypass deterministic booster
    - `:skip_pack`  — set `true` to bypass context packer

  ## Returns
    `{:ok, result}` or `{:error, term()}`
  """
  @spec prompt(String.t(), keyword()) :: {:ok, result()} | {:error, term()}
  def prompt(input, opts) when is_binary(input) and is_list(opts) do
    api_key  = Keyword.fetch!(opts, :api_key)
    provider = Keyword.get(opts, :provider, "openai")
    model    = Keyword.get(opts, :model, "gpt-4o-mini")
    ttl      = Keyword.get(opts, :ttl, 300)

    # Step 1: Booster — resolve deterministically if possible
    unless Keyword.get(opts, :skip_boost, false) do
      case Booster.boost(input) do
        {:ok, text} ->
          return_boosted(text)

        :skip ->
          nil
      end
    end
    |> case do
      {:ok, _} = boosted -> boosted
      _ -> run_pack_cache_gateway(input, api_key, provider, model, ttl, opts)
    end
  end

  # ---------------------------------------------------------------------------
  # Internals
  # ---------------------------------------------------------------------------

  defp run_pack_cache_gateway(input, api_key, provider, model, ttl, opts) do
    # Step 2: Packer — compress context
    packed_text =
      if Keyword.get(opts, :skip_pack, false) do
        %{text: input, savings_pct: 0.0}
      else
        Packer.pack(input)
      end

    prompt_text  = packed_text.text
    savings      = packed_text.savings_pct

    # Step 3: Cache — check for a prior response
    unless Keyword.get(opts, :skip_cache, false) do
      case Cache.get(prompt_text) do
        {:ok, cached_response} ->
          {:ok,
           %{
             text:        cached_response,
             boosted:     false,
             cached:      true,
             provider:    provider,
             model:       model,
             savings_pct: savings
           }}

        :miss ->
          nil
      end
    end
    |> case do
      {:ok, _} = cached -> cached
      _ -> call_gateway_and_cache(prompt_text, api_key, provider, model, ttl, savings, opts)
    end
  end

  defp call_gateway_and_cache(prompt, api_key, provider, model, ttl, savings, opts) do
    # Step 4: Gateway call
    case Gateway.call(prompt, provider, model, api_key, opts) do
      {:ok, gw_result} ->
        response_text = Map.get(gw_result, :text) || Map.get(gw_result, "text") || ""

        unless Keyword.get(opts, :skip_cache, false) do
          Cache.set(prompt, response_text, ttl)
        end

        {:ok,
         %{
           text:        response_text,
           boosted:     false,
           cached:      false,
           provider:    Map.get(gw_result, :provider, provider),
           model:       Map.get(gw_result, :model, model),
           savings_pct: savings
         }}

      {:error, _} = err ->
        err
    end
  end

  defp return_boosted(text) do
    {:ok,
     %{
       text:        text,
       boosted:     true,
       cached:      false,
       provider:    nil,
       model:       nil,
       savings_pct: 100.0
     }}
  end
end
