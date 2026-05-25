# frozen_string_literal: true

require 'net/http'
require 'json'
require 'uri'

module ClawPipe
  class GatewayError < StandardError
    attr_reader :status_code, :response_body

    def initialize(status_code, body = '')
      detail = body.empty? ? '' : " -- #{body[0, 200]}"
      super("ClawPipe gateway error: #{status_code}#{detail}")
      @status_code = status_code
      @response_body = body
    end
  end

  # HTTP client for the ClawPipe gateway API.
  # Uses only stdlib Net::HTTP — no external gems required.
  class Gateway
    BASE_URL = 'https://api.clawpipe.ai/v1'

    def initialize(api_key:, gateway_url: BASE_URL)
      @api_key = api_key
      @gateway_url = gateway_url
    end

    # POST /v1/prompt and return a Hash with :text, :tokens_in, :tokens_out, :latency_ms.
    def call(prompt:, provider: 'openai', model: 'gpt-4o-mini', **opts)
      t0 = now_ms
      uri = URI("#{@gateway_url}/prompt")
      payload = { prompt: prompt, provider: provider, model: model }.merge(opts)

      response = post_json(uri, payload)
      body = response.body.to_s

      raise GatewayError.new(response.code.to_i, body) if response.code.to_i >= 400

      parsed = JSON.parse(body, symbolize_names: true)
      latency = now_ms - t0

      {
        text: parsed[:text] || parsed[:content] || '',
        tokens_in: parsed[:tokensIn] || parsed[:tokens_in] || 0,
        tokens_out: parsed[:tokensOut] || parsed[:tokens_out] || 0,
        latency_ms: parsed[:latencyMs] || parsed[:latency_ms] || latency,
      }
    end

    private

    def post_json(uri, payload)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == 'https'
      http.open_timeout = 10
      http.read_timeout = 60

      request = Net::HTTP::Post.new(uri.path.empty? ? '/' : uri.path)
      request['Content-Type'] = 'application/json'
      request['Authorization'] = "Bearer #{@api_key}"
      request.body = JSON.generate(payload)

      http.request(request)
    end

    def now_ms
      (Time.now.to_f * 1000).round
    end
  end
end
