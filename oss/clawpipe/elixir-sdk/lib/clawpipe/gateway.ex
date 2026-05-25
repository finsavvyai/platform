defmodule ClawPipe.Gateway do
  @moduledoc """
  HTTP gateway client for the ClawPipe API.

  Dispatches prompts to `https://api.clawpipe.ai/v1/prompt` (or a configurable
  base URL) using the `Req` library.
  """

  @default_base_url "https://api.clawpipe.ai/v1"
  @timeout          60_000

  @doc """
  Send `prompt` to the ClawPipe gateway.

  ## Required options
    - `:api_key`   — your ClawPipe API key

  ## Optional options
    - `:provider`  — override provider (e.g. `"openai"`, `"anthropic"`)
    - `:model`     — override model (e.g. `"gpt-4o"`)
    - `:base_url`  — override gateway base URL (useful for tests)
    - `:max_tokens`— max tokens to generate

  ## Returns
    - `{:ok, map()}` with at minimum `:text`, `:provider`, `:model`, `:cached`, `:boosted`
    - `{:error, term()}`
  """
  @spec call(String.t(), String.t(), String.t(), String.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def call(prompt, provider, model, api_key, opts \\ [])
      when is_binary(prompt) and is_binary(provider) and
             is_binary(model) and is_binary(api_key) do
    base_url = Keyword.get(opts, :base_url, @default_base_url)
    url      = "#{base_url}/prompt"

    payload =
      %{prompt: prompt, provider: provider, model: model}
      |> maybe_put(:max_tokens, Keyword.get(opts, :max_tokens))

    headers = build_headers(api_key)

    Req.post(url,
      json:    payload,
      headers: headers,
      receive_timeout: @timeout
    )
    |> handle_response()
  end

  @doc """
  Convenience wrapper: call the gateway with just an `api_key`.

  Provider and model default to `"openai"` / `"gpt-4o-mini"`.
  """
  @spec simple_call(String.t(), String.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def simple_call(prompt, api_key, opts \\ []) do
    provider = Keyword.get(opts, :provider, "openai")
    model    = Keyword.get(opts, :model, "gpt-4o-mini")
    call(prompt, provider, model, api_key, opts)
  end

  # ---------------------------------------------------------------------------
  # Internals
  # ---------------------------------------------------------------------------

  defp build_headers(api_key) do
    [
      {"content-type", "application/json"},
      {"authorization", "Bearer #{api_key}"},
      {"user-agent", "clawpipe-elixir/3.6.0"}
    ]
  end

  defp handle_response({:ok, %Req.Response{status: status, body: body}})
       when status in 200..299 do
    parsed = normalise_body(body)
    {:ok, parsed}
  end

  defp handle_response({:ok, %Req.Response{status: status, body: body}}) do
    detail = extract_error_detail(body)
    {:error, %{status: status, message: "ClawPipe gateway error: #{status}#{detail}"}}
  end

  defp handle_response({:error, reason}), do: {:error, reason}

  defp normalise_body(body) when is_map(body) do
    body
    |> Map.new(fn {k, v} -> {string_to_atom_key(k), v} end)
  end

  defp normalise_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, map} -> normalise_body(map)
      _          -> %{text: body}
    end
  end

  defp normalise_body(body), do: %{raw: body}

  defp string_to_atom_key(k) when is_binary(k) do
    k
    |> String.replace("-", "_")
    |> String.to_existing_atom()
  rescue
    ArgumentError -> String.to_atom(k)
  end

  defp string_to_atom_key(k) when is_atom(k), do: k

  defp extract_error_detail(body) when is_binary(body) and byte_size(body) > 0 do
    " — #{String.slice(body, 0, 200)}"
  end

  defp extract_error_detail(body) when is_map(body) do
    msg = Map.get(body, "message") || Map.get(body, "error") || ""
    if msg != "", do: " — #{msg}", else: ""
  end

  defp extract_error_detail(_), do: ""

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, val), do: Map.put(map, key, val)
end
