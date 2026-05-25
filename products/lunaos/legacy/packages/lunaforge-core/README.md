# LunaForge Core

This package is the **local runtime core** of LunaForge. It is environment-agnostic:
you can use it from a VS Code extension, a CLI, or tests.

It provides:

- An `EventBus` pub/sub system.
- A `ModeRegistry` for registering and activating LunaForge modes.
- A very small `buildProjectGraph` function (placeholder for real analysis).
- A `WorkerClient` wrapper to talk to the Cloudflare Agent Brain worker.
- A `LunaForgeCore` class that orchestrates all of the above.

In a VS Code extension, you would:

1. Construct `LunaForgeCore` with workspace info and a function that lists files.
2. Register modes (Galaxy, CodeFlow, TimeTravel, etc.) against `core.modes`.
3. Use `core.bus` to subscribe to `graph:ready`, `plan:received`, etc.
4. Use `core.requestPlan()` to obtain structured plans from the backend.
