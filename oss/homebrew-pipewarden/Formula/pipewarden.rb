# Homebrew formula for PipeWarden.
#
# Bump version + sha256 after each release:
#   cd pipewarden && scripts/update-homebrew-formula.sh vX.Y.Z
#   cp packaging/homebrew/pipewarden.rb ../homebrew-pipewarden/Formula/pipewarden.rb
class Pipewarden < Formula
  desc "AI-aware AppSec for CI/CD pipelines, Cursor, and Claude Code"
  homepage "https://pipewarden.io"
  license "MIT"
  version "0.0.0" # bumped by release script

  on_macos do
    on_arm do
      url "https://github.com/finsavvyai/pipewarden/releases/download/v#{version}/pipewarden-#{version}-darwin-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/finsavvyai/pipewarden/releases/download/v#{version}/pipewarden-#{version}-darwin-amd64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/finsavvyai/pipewarden/releases/download/v#{version}/pipewarden-#{version}-linux-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/finsavvyai/pipewarden/releases/download/v#{version}/pipewarden-#{version}-linux-amd64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install "pipewarden"
    prefix.install "README.md"
    prefix.install "LICENSE"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/pipewarden --version")
  end
end
