# frozen_string_literal: true

require_relative '../lib/clawpipe/packer'

RSpec.describe ClawPipe::Packer do
  subject(:packer) { described_class.new }

  describe '#estimate_tokens' do
    it 'estimates ~1 token per 4 chars' do
      expect(packer.estimate_tokens('abcd')).to eq(1)
      expect(packer.estimate_tokens('a' * 100)).to eq(25)
    end

    it 'rounds up for partial tokens' do
      expect(packer.estimate_tokens('abc')).to eq(1)
      expect(packer.estimate_tokens('abcde')).to eq(2)
    end
  end

  describe '#pack' do
    it 'returns a PackResult struct' do
      result = packer.pack('Hello world')
      expect(result).to be_a(ClawPipe::PackResult)
      expect(result.packed).to be_a(String)
      expect(result.savings).to match(/\d+%/)
    end

    it 'compresses multiple blank lines into one' do
      text = "line one\n\n\n\nline two"
      result = packer.pack(text)
      expect(result.packed).not_to include("\n\n\n")
    end

    it 'strips trailing whitespace from lines' do
      text = "line one   \nline two   "
      result = packer.pack(text)
      lines = result.packed.split("\n")
      lines.each { |l| expect(l).to eq(l.rstrip) }
    end

    it 'deduplicates repeated blocks longer than 50 chars' do
      long_block = 'x' * 60
      text = "#{long_block}\n\n#{long_block}"
      result = packer.pack(text)
      # deduplicated — appears only once
      expect(result.packed.scan(long_block).length).to eq(1)
    end

    it 'prepends system message when provided' do
      result = packer.pack('user prompt', system: 'system instructions')
      expect(result.packed).to include('system instructions')
      expect(result.packed).to include('user prompt')
    end

    it 'reports 0% savings when text is already compact' do
      result = packer.pack('hello')
      expect(result.savings).to eq('0%')
    end

    it 'packed_tokens <= original_tokens' do
      text = "word " * 200
      result = packer.pack(text)
      expect(result.packed_tokens).to be <= result.original_tokens
    end
  end

  describe 'PackerConfig' do
    it 'can disable whitespace compression' do
      config = ClawPipe::PackerConfig.new(
        compress_whitespace: false, deduplication: false,
        strip_boilerplate: false, max_tokens: 100_000
      )
      p = ClawPipe::Packer.new(config)
      text = "hello\n\n\n\nworld"
      result = p.pack(text)
      expect(result.packed).to include("\n\n\n")
    end
  end
end
