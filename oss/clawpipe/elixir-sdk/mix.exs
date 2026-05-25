defmodule ClawPipe.MixProject do
  use Mix.Project

  def project do
    [
      app: :clawpipe_ai,
      version: "3.6.0",
      elixir: "~> 1.14",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      description: "ClawPipe SDK — cut LLM costs 30-50% with one line of code",
      package: package()
    ]
  end

  def application do
    [extra_applications: [:logger], mod: {ClawPipe.Application, []}]
  end

  defp deps do
    [
      {:req, "~> 0.5"},
      {:ex_doc, "~> 0.30", only: :dev, runtime: false},
      {:bypass, "~> 2.1", only: :test}
    ]
  end

  defp package do
    [
      licenses: ["MIT"],
      links: %{"GitHub" => "https://github.com/finsavvyai/clawpipe"}
    ]
  end
end
