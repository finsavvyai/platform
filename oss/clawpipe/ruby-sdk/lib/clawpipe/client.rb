# frozen_string_literal: true

require_relative 'booster'
require_relative 'packer'
require_relative 'cache'
require_relative 'gateway'

module ClawPipe
  # Main entry point for the ClawPipe SDK.
  #
  # Runs the full local pipeline:
  #   Booster -> Packer -> Cache -> Gateway
  #
  # Example:
  #   pipe = ClawPipe::Client.new(api_key: 'cp_xxx')
  #   result = pipe.prompt('What is 2 + 2?')
  #   puts result[:text]     # => "4"
  #   puts result[:savings]  # => {boosted: true, cost_saved: '$0.001'}
  class Client
    COST_PER_TOKEN = 0.000002 # rough blended estimate

    def initialize(
      api_key:,
      gateway_url: Gateway::BASE_URL,
      cache_ttl: Cache::DEFAULT_TTL,
      enable_booster: true,
      enable_packer: true,
      enable_cache: true
    )
      @api_key = api_key
      @enable_booster = enable_booster
      @enable_packer = enable_packer
      @enable_cache = enable_cache

      @booster = Booster.new
      @packer = Packer.new
      @cache = Cache.new(ttl: cache_ttl)
      @gateway = Gateway.new(api_key: api_key, gateway_url: gateway_url)
    end

    # Run prompt through the full pipeline.
    # Returns Hash with :text, :savings, :meta.
    def prompt(input_text, provider: 'openai', model: 'gpt-4o-mini', **opts)
      # Stage 1: Booster
      if @enable_booster
        resolved = @booster.try_resolve(input_text)
        if resolved
          return build_result(resolved, boosted: true, cached: false, packed: false,
                              tokens_in: 0, tokens_out: 0, latency_ms: 0)
        end
      end

      # Stage 2: Packer
      packed_text = input_text
      pack_savings = '0%'
      if @enable_packer
        pack = @packer.pack(input_text)
        packed_text = pack.packed
        pack_savings = pack.savings
      end

      # Stage 3: Cache
      if @enable_cache
        cache_key = @cache.key(packed_text, { provider: provider, model: model })
        cached = @cache.get(cache_key)
        if cached
          return build_result(cached, boosted: false, cached: true, packed: @enable_packer,
                              tokens_in: 0, tokens_out: 0, latency_ms: 0,
                              context_savings: pack_savings)
        end
      end

      # Stage 4: Gateway
      response = @gateway.call(
        prompt: packed_text,
        provider: provider,
        model: model,
        **opts
      )

      text = response[:text]

      # Store in cache
      if @enable_cache
        cache_key ||= @cache.key(packed_text, { provider: provider, model: model })
        @cache.set(cache_key, text)
      end

      build_result(text, boosted: false, cached: false, packed: @enable_packer,
                   tokens_in: response[:tokens_in], tokens_out: response[:tokens_out],
                   latency_ms: response[:latency_ms], context_savings: pack_savings,
                   provider: provider, model: model)
    end

    def cache_stats
      @cache.stats
    end

    private

    def build_result(text, boosted:, cached:, packed:, tokens_in:, tokens_out:,
                     latency_ms:, context_savings: '0%', provider: '', model: '')
      cost = (tokens_in + tokens_out) * COST_PER_TOKEN
      {
        text: text,
        savings: {
          boosted: boosted,
          cached: cached,
          packed: packed,
          cost_saved: boosted || cached ? format('$%.4f', COST_PER_TOKEN * 500) : '$0.0000',
        },
        meta: {
          boosted: boosted,
          cached: cached,
          packed: packed,
          context_savings: context_savings,
          provider: provider,
          model: model,
          tokens_in: tokens_in,
          tokens_out: tokens_out,
          latency_ms: latency_ms,
          estimated_cost_usd: cost.round(6),
        },
      }
    end
  end
end
