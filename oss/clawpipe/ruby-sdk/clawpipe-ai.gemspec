# frozen_string_literal: true

require_relative 'lib/clawpipe/version'

Gem::Specification.new do |s|
  s.name        = 'clawpipe-ai'
  s.version     = ClawPipe::VERSION
  s.summary     = 'ClawPipe SDK -- cut LLM costs 30-50% with one line of code'
  s.description = 'Local pipeline: Booster + Packer + Cache + Gateway. No proxy.'
  s.authors     = ['ClawPipe Team']
  s.email       = 'info@finsavvyai.com'
  s.homepage    = 'https://clawpipe.ai'
  s.license     = 'MIT'
  s.files       = Dir['lib/**/*.rb']
  s.required_ruby_version = '>= 3.0'

  s.add_development_dependency 'rspec', '~> 3.13'
  s.add_development_dependency 'webmock', '~> 3.23'
end
