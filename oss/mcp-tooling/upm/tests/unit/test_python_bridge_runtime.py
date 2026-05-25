"""Tests for the Python↔Java bridge runtime."""

import socket

import pytest

pytest.importorskip("py4j")

from udp.bridges import PythonBridgeRuntime  # noqa: E402 - import guarded by importorskip


def _available_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_python_bridge_runtime_start_and_preload():
    runtime = PythonBridgeRuntime(
        host="127.0.0.1",
        port=_available_port(),
        preload_modules=["math"],
    )

    info = runtime.start()
    assert info.host == "127.0.0.1"
    assert info.port > 0

    runtime.ensure_modules(["json"])
    refreshed = runtime.connection_info
    assert "math" in refreshed.preload_modules
    assert "json" in refreshed.preload_modules

    runtime.shutdown()
