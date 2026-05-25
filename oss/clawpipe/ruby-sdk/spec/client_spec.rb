# frozen_string_literal: true

require 'webmock/rspec'
require_relative '../lib/clawpipe'

RSpec.describe ClawPipe::Client do
  let(:api_key) { 'cp_test_key' }
  let(:gateway_url) { 'https://api.clawpipe.ai/v1' }
  subject(:client) { described_class.new(api_key: api_key) }

  describe 'booster short-circuits LLM calls' do
    it 'resolves math without hitting the gateway' do
      result = client.prompt('what is 2 + 2')
      expect(result[:text]).to eq('4')
      expect(result[:savings][:boosted]).to be true
      expect(result[:meta][:tokens_in]).to eq(0)
    end

    it 'resolves UUID without a network call' do
      result = client.prompt('generate a uuid')
      expect(result[:text]).to match(/\A[0-9a-f-]{36}\z/)
      expect(result[:savings][:boosted]).to be true
    end

    it 'resolves uppercase conversion locally' do
      result = client.prompt('convert "world" to uppercase')
      expect(result[:text]).to eq('WORLD')
      expect(result[:savings][:boosted]).to be true
    end

    it 'resolves reverse locally' do
      result = client.prompt('reverse "hello"')
      expect(result[:text]).to eq('olleh')
    end
  end

  describe 'cache hit on second call' do
    before do
      stub_request(:post, "#{gateway_url}/prompt")
        .to_return(
          status: 200,
          body: JSON.generate({ text: 'Paris', tokensIn: 10, tokensOut: 5, latencyMs: 120 }),
          headers: { 'Content-Type' => 'application/json' }
        )
    end

    it 'returns cached response on second identical call' do
      prompt = 'What is the capital of France?'
      client.prompt(prompt)
      result = client.prompt(prompt)
      expect(result[:text]).to eq('Paris')
      expect(result[:savings][:cached]).to be true
      expect(WebMock).to have_requested(:post, "#{gateway_url}/prompt").once
    end
  end

  describe 'gateway call when no boost or cache' do
    before do
      stub_request(:post, "#{gateway_url}/prompt")
        .to_return(
          status: 200,
          body: JSON.generate({ text: 'The sky is blue.', tokensIn: 20, tokensOut: 10, latencyMs: 200 }),
          headers: { 'Content-Type' => 'application/json' }
        )
    end

    it 'calls the gateway and returns text' do
      result = client.prompt('Why is the sky blue?')
      expect(result[:text]).to eq('The sky is blue.')
      expect(result[:meta][:tokens_in]).to eq(20)
      expect(result[:meta][:tokens_out]).to eq(10)
    end

    it 'includes meta with provider and model' do
      result = client.prompt('Why is the sky blue?', provider: 'anthropic', model: 'claude-3-haiku')
      expect(result[:meta][:provider]).to eq('anthropic')
      expect(result[:meta][:model]).to eq('claude-3-haiku')
    end
  end

  describe 'gateway error handling' do
    before do
      stub_request(:post, "#{gateway_url}/prompt")
        .to_return(status: 429, body: 'Rate limit exceeded')
    end

    it 'raises GatewayError on 4xx responses' do
      expect { client.prompt('trigger error') }.to raise_error(ClawPipe::GatewayError) do |e|
        expect(e.status_code).to eq(429)
        expect(e.message).to include('429')
      end
    end
  end

  describe '#cache_stats' do
    it 'returns cache statistics struct' do
      stats = client.cache_stats
      expect(stats).to respond_to(:hits, :misses, :size, :hit_rate)
    end
  end

  describe 'pipeline flags' do
    it 'skips booster when enable_booster: false' do
      stub_request(:post, "#{gateway_url}/prompt")
        .to_return(
          status: 200,
          body: JSON.generate({ text: '4', tokensIn: 5, tokensOut: 2, latencyMs: 50 }),
          headers: { 'Content-Type' => 'application/json' }
        )
      c = described_class.new(api_key: api_key, enable_booster: false)
      result = c.prompt('what is 2 + 2')
      expect(result[:savings][:boosted]).to be false
      expect(WebMock).to have_requested(:post, "#{gateway_url}/prompt").once
    end
  end
end
