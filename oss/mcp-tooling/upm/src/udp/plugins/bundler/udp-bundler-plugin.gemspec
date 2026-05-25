# frozen_string_literal: true

require_relative "lib/udp/bundler/plugin/version"

Gem::Specification.new do |spec|
  spec.name = "udp-bundler-plugin"
  spec.version = Udp::Bundler::Plugin::VERSION
  spec.authors = ["UDP Team"]
  spec.email = ["team@universaldependency.com"]

  spec.summary = "Bundler plugin for Universal Dependency Platform (UDP) integration"
  spec.description = "Universal Dependency Platform integration for Ruby projects using Bundler. " \
                     "Enables cross-language dependency management for Ruby applications."
  spec.homepage = "https://universaldependency.com"
  spec.license = "Apache-2.0"
  spec.required_ruby_version = ">= 3.0.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/universal-dependency-platform/udp-bundler-plugin"
  spec.metadata["changelog_uri"] = "https://github.com/universal-dependency-platform/udp-bundler-plugin/blob/main/CHANGELOG.md"
  spec.metadata["bug_tracker_uri"] = "https://github.com/universal-dependency-platform/udp-bundler-plugin/issues"
  spec.metadata["documentation_uri"] = "https://docs.universaldependency.com/plugins/bundler"

  # Specify which files should be added to the gem when it is released.
  spec.files = Dir.chdir(__dir__) do
    `git ls-files -z`.split("\x0").reject do |f|
      (File.expand_path(f) == __FILE__) ||
        f.start_with?(*%w[bin/ test/ spec/ features/ .git .circleci appveyor Gemfile])
    end
  end
  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  # Core dependencies
  spec.add_dependency "bundler", ">= 2.0"
  spec.add_dependency "yaml", "~> 0.2"
  spec.add_dependency "httparty", "~> 0.21"
  spec.add_dependency "thor", "~> 1.3"
  spec.add_dependency "colorize", "~> 0.8"

  # Template engine
  spec.add_dependency "erb", "~> 4.0"
  spec.add_dependency "liquid", "~> 5.4"

  # File operations
  spec.add_dependency "fileutils", "~> 1.7"

  # Development dependencies
  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "rspec", "~> 3.12"
  spec.add_development_dependency "rubocop", "~> 1.57"
  spec.add_development_dependency "rubocop-rake", "~> 0.6"
  spec.add_development_dependency "rubocop-rspec", "~> 2.25"

  # Plugin system
  spec.metadata["rubygems_mfa_required"] = "true"
end