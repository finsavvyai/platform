Pod::Spec.new do |spec|
  spec.name         = "UdpCocoaPodsPlugin"
  spec.version      = "1.0.0"
  spec.summary      = "CocoaPods plugin for Universal Dependency Platform (UDP) integration"
  spec.description  = <<-DESC
    Universal Dependency Platform integration for iOS/Swift projects using CocoaPods.
    Enables cross-language dependency management for iOS applications.
  DESC

  spec.homepage     = "https://universaldependency.com"
  spec.license      = { :type => "Apache-2.0", :file => "LICENSE" }
  spec.author       = { "UDP Team" => "team@universaldependency.com" }
  spec.source       = { :git => "https://github.com/universal-dependency-platform/udp-cocoapods-plugin.git", :tag => "#{spec.version}" }

  spec.swift_version = "5.9"
  spec.platform     = :ios, "13.0"
  spec.osx.deployment_target = "10.15"
  spec.watchos.deployment_target = "6.0"
  spec.tvos.deployment_target = "13.0"

  spec.source_files = "Sources/**/*.swift"
  spec.preserve_paths = ["bin/**/*", "templates/**/*"]

  spec.dependency "Alamofire", "~> 5.8"
  spec.dependency "Yams", "~> 5.0"

  spec.prepare_command = <<-CMD
    # Install UDP CLI tool
    if ! command -v udp-swift &> /dev/null; then
      echo "Installing UDP Swift CLI..."
      swift build -c release
      cp .build/release/udp-swift /usr/local/bin/udp-swift || sudo cp .build/release/udp-swift /usr/local/bin/udp-swift
    fi
  CMD

  spec.script_phase = {
    :name => "UDP Integration",
    :script => <<-SCRIPT
      if [ -f "${SRCROOT}/udp.yml" ]; then
        echo "Running UDP setup..."
        "${SRCROOT}/bin/udp-swift" setup --config "${SRCROOT}/udp.yml"
      fi
    SCRIPT,
    :execution_position => :before_compile
  }
end