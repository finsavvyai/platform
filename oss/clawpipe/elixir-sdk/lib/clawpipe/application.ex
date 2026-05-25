defmodule ClawPipe.Application do
  @moduledoc "OTP Application — starts the Cache GenServer supervision tree."

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ClawPipe.Cache
    ]

    opts = [strategy: :one_for_one, name: ClawPipe.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
