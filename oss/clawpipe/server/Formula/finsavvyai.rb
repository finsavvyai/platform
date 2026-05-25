class Finsavvyai < Formula
  include Language::Python::Virtualenv

  desc "Self-hosted distributed AI gateway — OpenAI-compatible, zero vendor lock-in"
  homepage "https://github.com/finsavvyai/finsavvyai"
  url "https://github.com/finsavvyai/finsavvyai/archive/refs/tags/v1.0.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256_REPLACE_ON_RELEASE"
  license "MIT"
  head "https://github.com/finsavvyai/finsavvyai.git", branch: "main"

  bottle do
    sha256 cellar: :any_skip_relocation, arm64_sonoma: "PLACEHOLDER"
    sha256 cellar: :any_skip_relocation, ventura:      "PLACEHOLDER"
    sha256 cellar: :any_skip_relocation, x86_64_linux: "PLACEHOLDER"
  end

  depends_on "python@3.11"

  resource "aiohttp" do
    url "https://files.pythonhosted.org/packages/aiohttp-3.9.5.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "psutil" do
    url "https://files.pythonhosted.org/packages/psutil-5.9.8.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "colorama" do
    url "https://files.pythonhosted.org/packages/colorama-0.4.6.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "tabulate" do
    url "https://files.pythonhosted.org/packages/tabulate-0.9.0.tar.gz"
    sha256 "PLACEHOLDER"
  end

  resource "pyyaml" do
    url "https://files.pythonhosted.org/packages/PyYAML-6.0.1.tar.gz"
    sha256 "PLACEHOLDER"
  end

  def install
    virtualenv_install_with_resources
  end

  def post_install
    (var/"log/finsavvyai").mkpath
    (etc/"finsavvyai").mkpath
  end

  service do
    run [opt_bin/"finsavvyai", "start", "service", "gateway"]
    keep_alive true
    log_path var/"log/finsavvyai/gateway.log"
    error_log_path var/"log/finsavvyai/gateway.error.log"
    working_dir HOMEBREW_PREFIX
  end

  test do
    assert_match "FinSavvyAI", shell_output("#{bin}/finsavvyai --version")
    assert_match "doctor", shell_output("#{bin}/finsavvyai --help")
  end
end
