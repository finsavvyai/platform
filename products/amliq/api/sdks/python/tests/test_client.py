"""Tests for AMLIQ Python SDK client."""

import json
import pytest
import httpx
from pytest_httpx import HTTPXMock

from amliq import AMLIQClient, ScreenRequest
from amliq.errors import AuthError, RateLimitError


BASE = "https://api.amliq.io/api/v1"


def test_screen(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url=f"{BASE}/screen",
        json={"results": [{"entity_id": "ent_1", "matched_name": "John Smith",
                           "confidence": 0.95, "list_id": "ofac", "evidence": []}], "total": 1},
    )
    with AMLIQClient("test-key") as client:
        resp = client.screen(ScreenRequest(name="John Smith"))
        assert resp.total == 1
        assert resp.results[0].confidence == 0.95


def test_screen_fast(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url=f"{BASE}/screen/fast",
        json={"match": True, "confidence": 0.88, "matched_name": "John Smith"},
    )
    with AMLIQClient("test-key") as client:
        result = client.screen_fast("John Smith")
        assert result["match"] is True


def test_list_alerts(httpx_mock: HTTPXMock):
    httpx_mock.add_response(
        url=f"{BASE}/alerts",
        json={"alerts": [], "total": 0},
    )
    with AMLIQClient("test-key") as client:
        resp = client.list_alerts()
        assert resp.total == 0


def test_auth_error(httpx_mock: HTTPXMock):
    httpx_mock.add_response(url=f"{BASE}/alerts", status_code=401)
    with AMLIQClient("bad-key") as client:
        with pytest.raises(AuthError):
            client.list_alerts()


def test_rate_limit(httpx_mock: HTTPXMock):
    httpx_mock.add_response(url=f"{BASE}/alerts", status_code=429)
    with AMLIQClient("test-key") as client:
        with pytest.raises(RateLimitError):
            client.list_alerts()
