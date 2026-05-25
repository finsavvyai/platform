# frozen_string_literal: true

require_relative '../lib/clawpipe/booster'

RSpec.describe ClawPipe::Booster do
  subject(:booster) { described_class.new }

  describe '#rule_count' do
    it 'registers 6 default rules' do
      expect(booster.rule_count).to eq(6)
    end
  end

  describe '#try_resolve' do
    context 'math rule' do
      it 'resolves integer addition' do
        expect(booster.try_resolve('what is 2 + 2')).to eq('4')
      end

      it 'resolves multiplication' do
        expect(booster.try_resolve('calculate 6 * 7')).to eq('42')
      end

      it 'returns nil for non-math prompt' do
        expect(booster.try_resolve('tell me a joke')).to be_nil
      end
    end

    context 'date rule' do
      it 'returns today date string for date prompt' do
        result = booster.try_resolve('what is today')
        expect(result).to match(/\d{4}-\d{2}-\d{2}/)
      end

      it 'resolves "what day is it today"' do
        result = booster.try_resolve('what day is it today')
        expect(result).to eq(Date.today.to_s)
      end
    end

    context 'UUID rule' do
      it 'generates a valid UUID' do
        result = booster.try_resolve('generate a uuid')
        expect(result).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i)
      end

      it 'generates different UUIDs on each call' do
        r1 = booster.try_resolve('generate a uuid')
        r2 = booster.try_resolve('generate a uuid')
        expect(r1).not_to eq(r2)
      end
    end

    context 'uppercase rule' do
      it 'converts text to uppercase' do
        expect(booster.try_resolve('convert "hello" to uppercase')).to eq('HELLO')
      end

      it 'handles mixed case input' do
        expect(booster.try_resolve('convert "Hello World" to uppercase')).to eq('HELLO WORLD')
      end
    end

    context 'lowercase rule' do
      it 'converts text to lowercase' do
        expect(booster.try_resolve('convert "HELLO" to lowercase')).to eq('hello')
      end

      it 'handles mixed case input' do
        expect(booster.try_resolve('convert "Hello World" to lowercase')).to eq('hello world')
      end
    end

    context 'reverse rule' do
      it 'reverses a string' do
        expect(booster.try_resolve('reverse "hello"')).to eq('olleh')
      end

      it 'reverses a longer string' do
        expect(booster.try_resolve('reverse "abcde"')).to eq('edcba')
      end
    end

    context 'no rule matches' do
      it 'returns nil for an unknown prompt' do
        expect(booster.try_resolve('who is the president of france?')).to be_nil
      end
    end
  end

  describe '#add_rule' do
    it 'allows adding a custom rule' do
      rule = ClawPipe::BoosterRule.new(
        name: 'ping',
        test: ->(inp) { inp == 'ping' },
        resolve: ->(_inp) { 'pong' }
      )
      booster.add_rule(rule)
      expect(booster.try_resolve('ping')).to eq('pong')
      expect(booster.rule_count).to eq(7)
    end
  end
end
