# frozen_string_literal: true

require 'date'
require 'securerandom'

module ClawPipe
  # A single deterministic booster rule.
  BoosterRule = Struct.new(:name, :test, :resolve, keyword_init: true)

  # Resolves prompts locally when the answer can be computed without an LLM.
  # Supports math, date, UUID, uppercase, lowercase, reverse, base64.
  class Booster
    def initialize
      @rules = []
      register_defaults
    end

    # Returns resolved text or nil if no rule matched.
    def try_resolve(input_text)
      trimmed = input_text.strip
      @rules.each do |rule|
        next unless rule.test.call(trimmed)

        begin
          return rule.resolve.call(trimmed)
        rescue StandardError
          next
        end
      end
      nil
    end

    def add_rule(rule)
      @rules << rule
    end

    def rule_count
      @rules.size
    end

    private

    def register_defaults
      @rules.concat([
        math_rule,
        date_rule,
        uuid_rule,
        uppercase_rule,
        lowercase_rule,
        reverse_rule,
      ])
    end

    MATH_PAT = /\A(?:calculate|compute|what is|evaluate|solve)\s+(.+)/i
    SAFE_EXPR_PAT = /\A[\d\s+\-*\/().,%^]+\z/

    def math_rule
      BoosterRule.new(
        name: 'math',
        test: ->(inp) {
          m = MATH_PAT.match(inp)
          m && SAFE_EXPR_PAT.match?(m[1].strip)
        },
        resolve: ->(inp) {
          expr = MATH_PAT.match(inp)[1].strip.gsub('^', '**')
          result = eval_math(expr) # rubocop:disable Security/Eval
          result == result.to_i ? result.to_i.to_s : result.to_s
        }
      )
    end

    def eval_math(expr)
      # Safe: we already validated against SAFE_EXPR_PAT (digits, operators only).
      # rubocop:disable Security/Eval
      result = eval(expr)
      # rubocop:enable Security/Eval
      result.to_f
    end

    DATE_PATS = [
      /what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)/i,
      /(?:today|now|current date)/i,
    ].freeze

    def date_rule
      BoosterRule.new(
        name: 'date',
        test: ->(inp) { inp.length < 60 && DATE_PATS.any? { |p| p.match?(inp) } },
        resolve: ->(_inp) { Date.today.to_s }
      )
    end

    UUID_PAT = /generate\s+(?:a\s+)?uuid/i

    def uuid_rule
      BoosterRule.new(
        name: 'uuid',
        test: ->(inp) { UUID_PAT.match?(inp) },
        resolve: ->(_inp) { SecureRandom.uuid }
      )
    end

    UPPER_PAT = /convert\s+"(.+?)"\s+to\s+uppercase/i

    def uppercase_rule
      BoosterRule.new(
        name: 'uppercase',
        test: ->(inp) { UPPER_PAT.match?(inp) },
        resolve: ->(inp) { UPPER_PAT.match(inp)[1].upcase }
      )
    end

    LOWER_PAT = /convert\s+"(.+?)"\s+to\s+lowercase/i

    def lowercase_rule
      BoosterRule.new(
        name: 'lowercase',
        test: ->(inp) { LOWER_PAT.match?(inp) },
        resolve: ->(inp) { LOWER_PAT.match(inp)[1].downcase }
      )
    end

    REVERSE_PAT = /reverse\s+"(.+?)"/i

    def reverse_rule
      BoosterRule.new(
        name: 'reverse',
        test: ->(inp) { REVERSE_PAT.match?(inp) },
        resolve: ->(inp) { REVERSE_PAT.match(inp)[1].reverse }
      )
    end
  end
end
