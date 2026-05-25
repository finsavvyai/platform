# Python ↔ Java Bridge Runtime

The Universal Package Manager now ships with a Py4J-powered runtime that lets JVM
applications call Python libraries with low overhead. The bridge is started on
demand whenever the Universal Package Manager resolves a Maven↔PyPI dependency
pair and can also be launched manually.

## Quick Start

1. Ensure dependencies are installed:

   ```bash
   poetry install
   ```

2. Start the UDP API or run any workflow that touches Maven↔PyPI dependencies.
   The service bootstraps a Py4J `GatewayServer` using the host and port from
   `settings.bridge` (defaults to `127.0.0.1:25333`).

3. From Java, create a Py4J `GatewayServer`/`ClientServer` instance pointed at
   the configured host and port (see the [Py4J documentation](https://www.py4j.org/)
   for detailed samples). Once connected, the entry point exposes:

   - `preloadModule(String name)` – import and cache a module.
   - `preloadModules(Iterable<String> names)` – bulk preload.
   - `call(String module, String attributePath, Object[] args, Map<String, Object> kwargs)` – invoke
     a callable or read an attribute.
   - `describe(String module, String attributePath)` – retrieve metadata.

## Configuration

Bridge settings live under `settings.bridge` (see `src/udp/core/config.py`):

- `enabled`: toggle Py4J bridge generation.
- `host` / `port`: address exposed to JVM clients.
- `preload_modules`: modules eager-imported on startup to cut the first-call latency.

These values can be overridden through environment variables, for example:

```bash
export BRIDGE__HOST=0.0.0.0
export BRIDGE__PORT=26000
export BRIDGE__PRELOAD_MODULES='["numpy", "pandas"]'
```

## Programmatic Access

Within Python you can interact with the runtime via `PythonBridgeRuntime`:

```python
from udp.bridges import PythonBridgeRuntime

runtime = PythonBridgeRuntime(host="127.0.0.1", port=25333, preload_modules=["numpy"], auto_start=True)
info = runtime.connection_info
print(info.host, info.port)

# Ensure additional modules are cached
runtime.ensure_modules(["requests"])

# Call into Python directly (useful for diagnostics)
response = runtime.call("requests", "get", "https://httpbin.org/get")
print(response.status_code)
```

The bridge runtime is reference-counted by the `UniversalPackageManagerService`
and reused across resolutions to avoid process churn.

## TEDDK Sample Project

To try the bridge with the TELIA TEDDK sample located at
`/Users/shaharsolomon/projects/telia/teddk`:

1. Ensure the project contains its regular `pom.xml` plus a UPM manifest
   (for example `udp.yml`) that lists both the Java and PyPI dependencies you
   want resolved together.
2. From the UPM repository root, run the resolver against the TEDDK project’s
   manifests. Any Maven↔PyPI pairs discovered in the TEDDK manifests will cause
   the bridge to start and the returned recommendations will include the
   Py4J connection details.
3. In the TEDDK Java codebase (e.g., under
   `/Users/shaharsolomon/projects/telia/teddk/src/main/java`), create a Py4J
   client using the host/port that UPM reported and invoke the Python packages
   (requests, pandas, etc.) you need.

This setup lets you test end-to-end Java→Python calls inside the TEDDK sample
without additional manual wiring.
