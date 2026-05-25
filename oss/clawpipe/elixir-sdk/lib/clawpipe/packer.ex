defmodule ClawPipe.Packer do
  @moduledoc """
  Context Packer — compress context to reduce token count.

  Strategies applied in order:
  1. Whitespace compression
  2. Paragraph deduplication
  3. Boilerplate stripping (eslint-disable, @ts-*, 'use strict', JSDoc tags)
  4. Budget truncation (default 100 000 tokens)
  """

  @boilerplate_patterns [
    # JSDoc blocks with only annotation lines
    ~r/\/\*\*?\s*\n(\s*\*\s*@(?:param|returns|throws|example).*\n)*\s*\*\//m,
    # eslint-disable comments
    ~r/^\/\/\s*eslint-disable.*$/m,
    # TypeScript suppression comments
    ~r/^\/\/\s*@ts-(?:ignore|expect-error|nocheck).*$/m,
    # 'use strict' directives
    ~r/^'use strict';?\s*$/m,
    # istanbul ignore annotations
    ~r/^\/\*\s*istanbul ignore (?:next|else)\s*\*\/$/m
  ]

  @default_max_tokens 100_000

  @doc """
  Pack a prompt, returning a map with `:text` and `:savings_pct`.

  Options:
    - `:max_tokens`        — token budget (default #{@default_max_tokens})
    - `:system`            — optional system message prepended before packing
    - `:compress_whitespace` — boolean (default true)
    - `:deduplication`     — boolean (default true)
    - `:strip_boilerplate` — boolean (default true)
  """
  @spec pack(String.t(), keyword()) :: %{text: String.t(), savings_pct: float()}
  def pack(text, opts \\ []) when is_binary(text) do
    max_tokens        = Keyword.get(opts, :max_tokens, @default_max_tokens)
    system            = Keyword.get(opts, :system)
    do_whitespace     = Keyword.get(opts, :compress_whitespace, true)
    do_dedup          = Keyword.get(opts, :deduplication, true)
    do_strip          = Keyword.get(opts, :strip_boilerplate, true)

    original = if system, do: "#{system}\n\n#{text}", else: text
    original_tokens = estimate_tokens(original)

    packed =
      original
      |> maybe_compress_whitespace(do_whitespace)
      |> maybe_deduplicate(do_dedup)
      |> maybe_strip_boilerplate(do_strip)
      |> truncate(max_tokens)

    packed_tokens = estimate_tokens(packed)

    savings_pct =
      if original_tokens > 0 do
        Float.round((1 - packed_tokens / original_tokens) * 100, 1)
      else
        0.0
      end

    %{text: packed, savings_pct: max(0.0, savings_pct)}
  end

  @doc "Rough token estimate: ~4 chars per token."
  @spec estimate_tokens(String.t()) :: non_neg_integer()
  def estimate_tokens(text) when is_binary(text) do
    ceil(String.length(text) / 4)
  end

  # --- Internals ---

  defp maybe_compress_whitespace(text, true), do: compress_whitespace(text)
  defp maybe_compress_whitespace(text, _), do: text

  defp maybe_deduplicate(text, true), do: deduplicate(text)
  defp maybe_deduplicate(text, _), do: text

  defp maybe_strip_boilerplate(text, true), do: strip_boilerplate(text)
  defp maybe_strip_boilerplate(text, _), do: text

  defp compress_whitespace(text) do
    text
    |> String.split("\n")
    |> Enum.map(&String.trim_trailing/1)
    |> Enum.join("\n")
    |> then(&Regex.replace(~r/\n{3,}/, &1, "\n\n"))
    |> String.trim()
  end

  defp deduplicate(text) do
    text
    |> String.split("\n\n")
    |> Enum.reduce({[], MapSet.new()}, fn block, {acc, seen} ->
      normalized = block |> String.trim() |> String.downcase()

      if normalized == "" do
        {acc, seen}
      else
        if String.length(normalized) > 50 and MapSet.member?(seen, normalized) do
          {acc, seen}
        else
          {[block | acc], MapSet.put(seen, normalized)}
        end
      end
    end)
    |> then(fn {acc, _} -> acc |> Enum.reverse() |> Enum.join("\n\n") end)
  end

  defp strip_boilerplate(text) do
    result =
      Enum.reduce(@boilerplate_patterns, text, fn pat, acc ->
        Regex.replace(pat, acc, "")
      end)

    Regex.replace(~r/\n{3,}/, result, "\n\n") |> String.trim()
  end

  defp truncate(text, max_tokens) do
    max_chars = max_tokens * 4

    if String.length(text) <= max_chars do
      text
    else
      truncated = String.slice(text, 0, max_chars)
      last_nl   = find_last_newline(truncated, max_chars)
      cut       = if last_nl > max_chars * 0.8, do: last_nl, else: max_chars

      String.slice(text, 0, cut) <> "\n\n[Truncated — context exceeded budget]"
    end
  end

  defp find_last_newline(text, from) do
    case :binary.match(text, "\n", scope: {0, from}) do
      :nomatch -> 0
      {pos, _}  -> pos
    end
  end
end
