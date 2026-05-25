defmodule ClawPipe.Cache do
  @moduledoc """
  GenServer-backed in-memory prompt cache with SHA-256 keying and TTL.

  Entries are stored in an ETS table so reads are lock-free.
  A periodic sweep removes expired entries every `:sweep_ms` milliseconds.

  ## Usage

      ClawPipe.Cache.set("What is 2+2?", "4")
      ClawPipe.Cache.get("What is 2+2?")  # => {:ok, "4"}
  """

  use GenServer

  @table       :clawpipe_cache
  @default_ttl 300
  @sweep_ms    60_000

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @doc "Start the Cache GenServer (called automatically by the supervisor)."
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Look up a cached response for `prompt`.

  Returns `{:ok, response}` on a hit, `:miss` on a miss or expired entry.
  """
  @spec get(String.t()) :: {:ok, String.t()} | :miss
  def get(prompt) when is_binary(prompt) do
    key = cache_key(prompt)
    now = System.system_time(:second)

    case :ets.lookup(@table, key) do
      [{^key, value, expires_at}] when now < expires_at ->
        :ets.update_counter(@table, :__hits__, {2, 1}, {:__hits__, 0})
        {:ok, value}

      [{^key, _value, _expired}] ->
        :ets.delete(@table, key)
        bump_misses()
        :miss

      [] ->
        bump_misses()
        :miss
    end
  end

  @doc """
  Store `response` for `prompt` with an optional TTL in seconds (default #{@default_ttl}).
  """
  @spec set(String.t(), String.t(), non_neg_integer()) :: :ok
  def set(prompt, response, ttl \\ @default_ttl)
      when is_binary(prompt) and is_binary(response) and is_integer(ttl) do
    key        = cache_key(prompt)
    expires_at = System.system_time(:second) + ttl
    :ets.insert(@table, {key, response, expires_at})
    :ok
  end

  @doc "Remove a cached entry by prompt. Returns `:ok` whether or not it existed."
  @spec delete(String.t()) :: :ok
  def delete(prompt) when is_binary(prompt) do
    :ets.delete(@table, cache_key(prompt))
    :ok
  end

  @doc "Clear every cached entry (keeps stat counters)."
  @spec clear() :: :ok
  def clear do
    :ets.match_delete(@table, {:_, :_, :_})
    :ok
  end

  @doc "Return cache statistics."
  @spec stats() :: %{size: non_neg_integer(), hits: non_neg_integer(), misses: non_neg_integer(), hit_rate: String.t()}
  def stats do
    hits   = counter_value(:__hits__)
    misses = counter_value(:__misses__)
    total  = hits + misses
    size   = :ets.info(@table, :size) - 2  # subtract the two counter rows

    hit_rate =
      if total > 0 do
        Float.round(hits / total * 100, 1)
      else
        0.0
      end

    %{size: max(0, size), hits: hits, misses: misses, hit_rate: "#{hit_rate}%"}
  end

  @doc "SHA-256 cache key for `prompt`."
  @spec cache_key(String.t()) :: String.t()
  def cache_key(prompt) when is_binary(prompt) do
    :crypto.hash(:sha256, prompt) |> Base.encode16(case: :lower)
  end

  # ---------------------------------------------------------------------------
  # GenServer callbacks
  # ---------------------------------------------------------------------------

  @impl true
  def init(_opts) do
    table = :ets.new(@table, [:set, :public, :named_table, read_concurrency: true])
    :ets.insert(table, {:__hits__, 0})
    :ets.insert(table, {:__misses__, 0})
    schedule_sweep()
    {:ok, %{table: table}}
  end

  @impl true
  def handle_info(:sweep, state) do
    sweep_expired()
    schedule_sweep()
    {:noreply, state}
  end

  # ---------------------------------------------------------------------------
  # Internals
  # ---------------------------------------------------------------------------

  defp schedule_sweep, do: Process.send_after(self(), :sweep, @sweep_ms)

  defp sweep_expired do
    now = System.system_time(:second)
    # Match all data rows (not counter rows which have integer values in pos 2)
    :ets.select_delete(@table, [
      {{:_, :_, :"$1"}, [{:is_integer, :"$1"}, {:<, :"$1", now}], [true]}
    ])
  end

  defp bump_misses do
    :ets.update_counter(@table, :__misses__, {2, 1}, {:__misses__, 0})
  end

  defp counter_value(key) do
    case :ets.lookup(@table, key) do
      [{^key, val}] -> val
      _             -> 0
    end
  end
end
