defmodule UdpHexPlugin.MixProject do
  use Mix.Project

  @version "1.0.0"
  @github_url "https://github.com/universal-dependency-platform/udp-hex-plugin"

  def project do
    [
      app: :udp_hex_plugin,
      version: @version,
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      package: package(),
      description: description(),
      docs: docs(),
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test
      ],
      dialyzer: [
        plt_file: {:no_warn, "priv/plts/dialyzer.plt"}
      ]
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto, :ssl, :inets],
      mod: {UdpHexPlugin.Application, []}
    ]
  end

  defp deps do
    [
      # Core dependencies
      {:yaml_elixir, "~> 2.9"},
      {:httpoison, "~> 2.2"},
      {:jason, "~> 1.4"},
      {:tesla, "~> 1.8"},

      # CLI and configuration
      {:optimus, "~> 0.4"},
      {:io_ansi_plus, "~> 0.2"},

      # Template engine
      {:eex, "~> 1.15"},
      {:liquid, "~> 0.9"},

      # File operations
      {:file_system, "~> 0.2"},

      # Development and testing
      {:ex_doc, "~> 0.31", only: :dev, runtime: false},
      {:excoveralls, "~> 0.18", only: :test},
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:ex_unit_notifier, "~> 1.3", only: :test},
      {:mix_test_watch, "~> 1.1", only: [:dev, :test], runtime: false}
    ]
  end

  defp description do
    """
    Hex plugin for Universal Dependency Platform (UDP) integration.
    Enables cross-language dependency management for Elixir projects.
    """
  end

  defp package do
    [
      name: "udp_hex_plugin",
      files: ~w(lib priv .formatter.exs mix.exs README* LICENSE* CHANGELOG*),
      licenses: ["Apache-2.0"],
      links: %{
        "GitHub" => @github_url,
        "Homepage" => "https://universaldependency.com",
        "Changelog" => "#{@github_url}/blob/main/CHANGELOG.md"
      },
      maintainers: ["UDP Team"]
    ]
  end

  defp docs do
    [
      name: "UDP Hex Plugin",
      source_ref: "v#{@version}",
      canonical: "https://hexdocs.pm/udp_hex_plugin",
      source_url: @github_url,
      main: "UdpHexPlugin",
      extras: [
        "README.md",
        "CHANGELOG.md"
      ]
    ]
  end
end