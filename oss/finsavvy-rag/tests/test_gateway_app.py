"""
Tests for the gateway proxy (``services/gateway/app.py``).

The gateway forwards ``/v1/{tail}`` to a configurable upstream and exposes a
``/healthz`` probe. We fake ``httpx.AsyncClient`` so no real upstream is
contacted, and assert the proxy preserves method, body, status, and strips
the Host header.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
import pytest
from fastapi.testclient import TestClient

from conftest import GATEWAY_DIR, load_module_from


# --- fake httpx async client ---------------------------------------------
class FakeHttpxResponse:
    def __init__(self, status_code=200, content=b"{}", headers=None):
        self.status_code = status_code
        self.content = content
        self.headers = headers or {"content-type": "application/json"}


class FakeAsyncClient:
    """Records the outbound request and returns a scripted response.

    A class-level ``script`` controls behaviour so tests can set it before the
    request is made. ``raise_http_error`` triggers the 502 branch.
    """

    last_request: Optional[Dict[str, Any]] = None
    response: FakeHttpxResponse = FakeHttpxResponse()
    raise_http_error: bool = False

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url, **kwargs):
        FakeAsyncClient.last_request = {"method": "GET", "url": url, "kwargs": kwargs}
        if FakeAsyncClient.raise_http_error:
            raise httpx.HTTPError("boom")
        return FakeAsyncClient.response

    async def request(self, method, url, headers=None, content=None):
        FakeAsyncClient.last_request = {
            "method": method,
            "url": url,
            "headers": headers,
            "content": content,
        }
        if FakeAsyncClient.raise_http_error:
            raise httpx.HTTPError("boom")
        return FakeAsyncClient.response


@pytest.fixture()
def gateway_module(monkeypatch):
    monkeypatch.setenv("GATEWAY_UPSTREAM", "local")
    monkeypatch.setenv("LLM_LOCAL_URL", "http://127.0.0.1:8000")
    FakeAsyncClient.last_request = None
    FakeAsyncClient.response = FakeHttpxResponse()
    FakeAsyncClient.raise_http_error = False

    gw = load_module_from("finsavvy_gateway_app", GATEWAY_DIR / "app.py")
    monkeypatch.setattr(gw.httpx, "AsyncClient", FakeAsyncClient)
    return gw


@pytest.fixture()
def client(gateway_module):
    return TestClient(gateway_module.app)


# --- current_upstream selection ------------------------------------------
def test_current_upstream_local_default(gateway_module):
    assert gateway_module.current_upstream() == gateway_module.LLM_LOCAL


def test_current_upstream_lb(monkeypatch):
    monkeypatch.setenv("GATEWAY_UPSTREAM", "lb")
    monkeypatch.setenv("LLM_LB_URL", "http://lb:9000")
    gw = load_module_from("finsavvy_gateway_app", GATEWAY_DIR / "app.py")
    assert gw.UPSTREAM == "lb"
    assert gw.current_upstream() == "http://lb:9000"


# --- /healthz -------------------------------------------------------------
def test_healthz_ok_when_upstream_200(client):
    FakeAsyncClient.response = FakeHttpxResponse(status_code=200)
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["status"] == 200
    assert FakeAsyncClient.last_request["url"].endswith("/v1/models")


def test_healthz_not_ok_when_upstream_500(client):
    FakeAsyncClient.response = FakeHttpxResponse(status_code=500)
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["ok"] is False
    assert res.json()["status"] == 500


def test_healthz_reports_error_on_exception(client):
    FakeAsyncClient.raise_http_error = True
    res = client.get("/healthz")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert "error" in body


# --- /v1/{tail} proxy -----------------------------------------------------
def test_proxy_forwards_post_body_and_strips_host(client):
    FakeAsyncClient.response = FakeHttpxResponse(
        status_code=201, content=b'{"id":"x"}'
    )
    res = client.post(
        "/v1/chat/completions",
        content=b'{"model":"m"}',
        headers={"X-Custom": "1", "Content-Type": "application/json"},
    )
    assert res.status_code == 201
    assert res.content == b'{"id":"x"}'

    req = FakeAsyncClient.last_request
    assert req["method"] == "POST"
    assert req["url"].endswith("/v1/chat/completions")
    assert req["content"] == b'{"model":"m"}'
    # Host header is stripped before forwarding.
    assert all(k.lower() != "host" for k in req["headers"])
    assert req["headers"].get("x-custom") == "1"


def test_proxy_forwards_get(client):
    FakeAsyncClient.response = FakeHttpxResponse(status_code=200, content=b"[]")
    res = client.get("/v1/models")
    assert res.status_code == 200
    assert FakeAsyncClient.last_request["method"] == "GET"
    assert FakeAsyncClient.last_request["url"].endswith("/v1/models")


def test_proxy_maps_httpx_error_to_502(client):
    FakeAsyncClient.raise_http_error = True
    res = client.post("/v1/chat/completions", content=b"{}")
    assert res.status_code == 502
    body = res.json()
    assert "error" in body
    assert "upstream" in body
