defmodule ClawPipe.Booster do
  @moduledoc """
  Deterministic transforms that skip LLM calls entirely.

  Rules applied in order:
  1. Math  — arithmetic expressions
  2. Date  — current date/time queries
  3. UUID  — UUID generation
  4. Uppercase — convert text to uppercase
  5. Lowercase — convert text to lowercase
  6. Reverse — reverse a string
  """

  @math_prefix ~r/^(?:calculate|compute|what is|evaluate|solve)\s+(.+)/i
  @safe_expr   ~r/^[\d\s+\-*\/().,%]+$/
  @date_pat    ~r/what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)|(?:today|now|current date)/i
  @uuid_pat    ~r/generate\s+(?:a\s+)?uuid/i
  @upper_pat   ~r/convert\s+"?(.+?)"?\s+to\s+uppercase/i
  @lower_pat   ~r/convert\s+"?(.+?)"?\s+to\s+lowercase/i
  @reverse_pat ~r/reverse\s+"?(.+?)"?$/i

  @doc """
  Attempt to resolve the prompt without an LLM call.

  Returns `{:ok, text}` when a rule matches, or `:skip` when no rule applies.
  """
  @spec boost(String.t()) :: {:ok, String.t()} | :skip
  def boost(prompt) when is_binary(prompt) do
    trimmed = String.trim(prompt)

    rules = [
      &math_rule/1,
      &date_rule/1,
      &uuid_rule/1,
      &uppercase_rule/1,
      &lowercase_rule/1,
      &reverse_rule/1
    ]

    Enum.reduce_while(rules, :skip, fn rule, _acc ->
      case rule.(trimmed) do
        {:ok, _} = result -> {:halt, result}
        :skip -> {:cont, :skip}
      end
    end)
  end

  # --- Rule 1: Math ---

  defp math_rule(input) do
    case Regex.run(@math_prefix, input, capture: :all_but_first) do
      [expr] ->
        clean = String.trim(expr)

        if Regex.match?(@safe_expr, clean) do
          evaluate_math(clean)
        else
          :skip
        end

      _ ->
        :skip
    end
  end

  defp evaluate_math(expr) do
    # Replace ^ with ** for exponentiation, then evaluate via Code
    sanitized =
      expr
      |> String.replace(",", "")
      |> String.replace("%", "/100")

    try do
      {result, _} = Code.eval_string(sanitized)

      text =
        if is_float(result) and trunc(result) == result do
          Integer.to_string(trunc(result))
        else
          to_string(result)
        end

      {:ok, text}
    rescue
      _ -> :skip
    end
  end

  # --- Rule 2: Date ---

  defp date_rule(input) do
    if Regex.match?(@date_pat, input) and String.length(input) < 60 do
      today = Date.utc_today() |> Date.to_iso8601()
      {:ok, today}
    else
      :skip
    end
  end

  # --- Rule 3: UUID ---

  defp uuid_rule(input) do
    if Regex.match?(@uuid_pat, input) do
      uuid = generate_uuid()
      {:ok, uuid}
    else
      :skip
    end
  end

  defp generate_uuid do
    <<a::32, b::16, _::4, c::12, _::2, d::30, e::48>> = :crypto.strong_rand_bytes(16)

    :io_lib.format(
      "~8.16.0b-~4.16.0b-4~3.16.0b-~2.16.0b~4.16.0b-~12.16.0b",
      [a, b, c, 0b10 * 0x40 + (d >>> 28), d &&& 0x0FFFFFFF, e]
    )
    |> IO.iodata_to_binary()
  end

  # --- Rule 4: Uppercase ---

  defp uppercase_rule(input) do
    case Regex.run(@upper_pat, input, capture: :all_but_first) do
      [text] -> {:ok, String.upcase(text)}
      _ -> :skip
    end
  end

  # --- Rule 5: Lowercase ---

  defp lowercase_rule(input) do
    case Regex.run(@lower_pat, input, capture: :all_but_first) do
      [text] -> {:ok, String.downcase(text)}
      _ -> :skip
    end
  end

  # --- Rule 6: Reverse ---

  defp reverse_rule(input) do
    case Regex.run(@reverse_pat, input, capture: :all_but_first) do
      [text] -> {:ok, String.reverse(text)}
      _ -> :skip
    end
  end
end
