"""High-performance Python bridge runtime for Java interoperability."""

from __future__ import annotations

import importlib
import inspect
import threading
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import structlog

try:  # pragma: no cover - import guard executed during runtime
    from py4j.java_gateway import GatewayServer
    from py4j.protocol import Py4JNetworkError
except Exception:  # pragma: no cover - defer hard failure until runtime usage
    GatewayServer = None  # type: ignore[assignment]
    Py4JNetworkError = Exception  # type: ignore[misc]


logger = structlog.get_logger()


class PythonModuleWrapper:
    """Caches module imports and attribute lookups for fast repeated access."""

    def __init__(self, module_name: str) -> None:
        self.module_name = module_name
        self._module = importlib.import_module(module_name)
        self._attribute_cache: Dict[Tuple[str, ...], Any] = {}
        self._lock = threading.RLock()

    def preload_attributes(self, attributes: Sequence[str]) -> None:
        for attribute_path in attributes:
            self._resolve_attribute(attribute_path)

    def call(self, attribute_path: str, args: Optional[Sequence[Any]] = None, kwargs: Optional[Dict[str, Any]] = None) -> Any:
        target = self._resolve_attribute(attribute_path)
        call_args = list(args or [])
        call_kwargs = dict(kwargs or {})

        if callable(target):
            return target(*call_args, **call_kwargs)
        if call_args or call_kwargs:
            raise TypeError(f"Attribute '{attribute_path}' on module '{self.module_name}' is not callable")
        return target

    def _resolve_attribute(self, attribute_path: str) -> Any:
        cache_key = tuple(part.strip() for part in attribute_path.split('.') if part.strip())
        if not cache_key:
            raise ValueError("Attribute path must contain at least one segment")

        with self._lock:
            if cache_key in self._attribute_cache:
                return self._attribute_cache[cache_key]

            target: Any = self._module
            for part in cache_key:
                if not hasattr(target, part):
                    raise AttributeError(f"Module '{self.module_name}' has no attribute '{part}' in path '{attribute_path}'")
                target = getattr(target, part)

            self._attribute_cache[cache_key] = target
            return target


class PythonBridgeEntryPoint:
    """Entry point exposed to the JVM through Py4J."""

    def __init__(self, preload_modules: Optional[Iterable[str]] = None) -> None:
        self._modules: Dict[str, PythonModuleWrapper] = {}
        self._lock = threading.RLock()
        if preload_modules:
            for module_name in preload_modules:
                try:
                    self.preloadModule(module_name)
                except Exception:  # pragma: no cover - defensive log
                    logger.exception("Failed to preload module", module_name=module_name)

    # Py4J expects camelCase method names for idiomatic Java usage.
    def preloadModule(self, module_name: str) -> bool:  # noqa: N802 - external API
        """Import and cache a module for subsequent JVM access."""
        with self._lock:
            if module_name in self._modules:
                return True
            self._modules[module_name] = PythonModuleWrapper(module_name)
            logger.info("Preloaded Python module for bridge", module_name=module_name)
        return True

    def preloadModules(self, module_names: Iterable[str]) -> bool:  # noqa: N802 - external API
        for module_name in module_names:
            self.preloadModule(module_name)
        return True

    def availableModules(self) -> List[str]:  # noqa: N802 - external API
        with self._lock:
            return list(self._modules.keys())

    def call(self, module_name: str, attribute_path: str, args: Optional[Sequence[Any]] = None, kwargs: Optional[Dict[str, Any]] = None) -> Any:
        wrapper = self._get_module(module_name)
        return wrapper.call(attribute_path, args, kwargs)

    def describe(self, module_name: str, attribute_path: str) -> Dict[str, Any]:
        wrapper = self._get_module(module_name)
        target = wrapper.call(attribute_path)
        return {
            "module": module_name,
            "attribute": attribute_path,
            "callable": callable(target),
            "type": type(target).__name__,
            "doc": inspect.getdoc(target) or "",
        }

    def _get_module(self, module_name: str) -> PythonModuleWrapper:
        with self._lock:
            wrapper = self._modules.get(module_name)
            if wrapper is None:
                wrapper = PythonModuleWrapper(module_name)
                self._modules[module_name] = wrapper
                logger.info("Lazy-loaded Python module for bridge", module_name=module_name)
            return wrapper


@dataclass(frozen=True)
class BridgeConnectionInfo:
    host: str
    port: int
    preload_modules: Tuple[str, ...]


class PythonBridgeRuntime:
    """Manages the lifecycle of the Py4J gateway for Java↔Python interop."""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 25333,
        preload_modules: Optional[Iterable[str]] = None,
        auto_start: bool = False,
    ) -> None:
        if GatewayServer is None:  # pragma: no cover - executed when dependency missing
            raise RuntimeError(
                "py4j is required for PythonBridgeRuntime. Install the project with the 'py4j' extra or ensure the dependency is available."
            )

        modules = tuple(dict.fromkeys(preload_modules or ()))
        self._entry_point = PythonBridgeEntryPoint(modules)
        self._host = host
        self._requested_port = port
        self._preload_modules = modules
        self._server = GatewayServer(
            entry_point=self._entry_point,
            address=host,
            port=port,
            auto_convert=True,
        )
        self._lock = threading.RLock()
        self._started = False

        if auto_start:
            self.start()

    def start(self) -> BridgeConnectionInfo:
        with self._lock:
            if self._started:
                return self.connection_info
            try:
                self._server.start()
                self._started = True
                logger.info(
                    "Started Py4J bridge runtime",
                    host=self._host,
                    requested_port=self._requested_port,
                    listening_port=self.listening_port,
                    preload_modules=list(self._preload_modules),
                )
            except Py4JNetworkError as exc:  # pragma: no cover - depends on environment
                raise RuntimeError(
                    f"Failed to start Py4J bridge on {self._host}:{self._requested_port}: {exc}"
                ) from exc
        return self.connection_info

    def shutdown(self) -> None:
        with self._lock:
            if not self._started:
                return
            self._server.shutdown()
            self._started = False
            logger.info("Stopped Py4J bridge runtime")

    def ensure_modules(self, module_names: Iterable[str]) -> None:
        self._entry_point.preloadModules(module_names)

    @property
    def listening_port(self) -> int:
        port = self._server.get_listening_port()
        if port == -1:
            return self._requested_port
        return port

    @property
    def connection_info(self) -> BridgeConnectionInfo:
        return BridgeConnectionInfo(
            host=self._host,
            port=self.listening_port,
            preload_modules=self._entry_point.availableModules(),
        )

    def call(self, module_name: str, attribute_path: str, *args: Any, **kwargs: Any) -> Any:
        if not self._started:
            raise RuntimeError("PythonBridgeRuntime must be started before invoking call")
        return self._entry_point.call(module_name, attribute_path, args, kwargs)

