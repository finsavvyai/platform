class Pushci < Formula
  desc "AI-native CI/CD — zero config, runs on your machine, free forever"
  homepage "https://pushci.dev"
  license "MIT"
  version "1.0.1"

  on_macos do
    on_arm do
      url "https://github.com/finsavvyai/pushci-cli/releases/download/v#{version}/pushci_#{version}_darwin_arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/finsavvyai/pushci-cli/releases/download/v#{version}/pushci_#{version}_darwin_amd64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/finsavvyai/pushci-cli/releases/download/v#{version}/pushci_#{version}_linux_arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/finsavvyai/pushci-cli/releases/download/v#{version}/pushci_#{version}_linux_amd64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    bin.install "pushci"
  end

  test do
    assert_match "pushci", shell_output("#{bin}/pushci version")
  end
end
