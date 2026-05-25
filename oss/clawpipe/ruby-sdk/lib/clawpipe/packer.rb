# frozen_string_literal: true

module ClawPipe
  PackResult = Struct.new(:packed, :original_tokens, :packed_tokens, :savings, keyword_init: true)

  PackerConfig = Struct.new(
    :max_tokens, :deduplication, :strip_boilerplate, :compress_whitespace,
    keyword_init: true
  ) do
    def self.default
      new(max_tokens: 100_000, deduplication: true, strip_boilerplate: true, compress_whitespace: true)
    end
  end

  # Compresses context to reduce token count.
  # Strategies: whitespace compression, deduplication, boilerplate stripping, budget truncation.
  class Packer
    def initialize(config = nil)
      @config = config || PackerConfig.default
    end

    def pack(input_text, system: nil)
      original = system ? "#{system}\n\n#{input_text}" : input_text
      original_tokens = estimate_tokens(original)

      packed = original
      packed = compress_whitespace(packed) if @config.compress_whitespace
      packed = deduplicate(packed) if @config.deduplication
      packed = strip_boilerplate(packed) if @config.strip_boilerplate
      packed = truncate_to_limit(packed)

      packed_tokens = estimate_tokens(packed)
      savings_pct = original_tokens > 0 ? ((1.0 - packed_tokens.to_f / original_tokens) * 100).round : 0

      PackResult.new(
        packed: packed,
        original_tokens: original_tokens,
        packed_tokens: packed_tokens,
        savings: "#{[0, savings_pct].max}%"
      )
    end

    def estimate_tokens(text)
      (text.length / 4.0).ceil
    end

    private

    def compress_whitespace(text)
      lines = text.split("\n").map(&:rstrip)
      joined = lines.join("\n")
      joined.gsub(/\n{3,}/, "\n\n").strip
    end

    def deduplicate(text)
      blocks = text.split("\n\n")
      seen = {}
      unique = []
      blocks.each do |block|
        normalized = block.strip.downcase
        next if normalized.empty?
        next if normalized.length > 50 && seen[normalized]

        seen[normalized] = true
        unique << block
      end
      unique.join("\n\n")
    end

    BOILERPLATE_PATTERNS = [
      /^\/\*\*?\s*\n(\s*\*\s*@(param|returns|throws|example).*\n)*\s*\*\//,
      /^\/\/\s*eslint-disable.*$/,
      /^\/\/\s*@ts-(ignore|expect-error|nocheck).*$/,
      /^'use strict';?\s*$/,
      /^\/\*\s*istanbul ignore (next|else)\s*\*\/$/,
    ].freeze

    def strip_boilerplate(text)
      result = text
      BOILERPLATE_PATTERNS.each { |pat| result = result.gsub(pat, '') }
      result.gsub(/\n{3,}/, "\n\n").strip
    end

    def truncate_to_limit(text)
      max_chars = @config.max_tokens * 4
      return text if text.length <= max_chars

      truncated = text[0, max_chars]
      last_nl = truncated.rindex("\n")
      cut = (last_nl && last_nl > max_chars * 0.8) ? last_nl : max_chars
      "#{truncated[0, cut]}\n\n[Truncated -- context exceeded budget]"
    end
  end
end
