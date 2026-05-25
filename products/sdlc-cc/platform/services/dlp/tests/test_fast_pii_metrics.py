"""Tests for the Agent Booster fast-PII metrics collector."""

from __future__ import annotations

import threading

import pytest

from app.services.fast_pii_metrics import BoosterMetrics, BoosterMetricsSnapshot


def test_initial_snapshot_is_empty():
    m = BoosterMetrics()
    s = m.snapshot()
    assert s.fast_path_count == 0
    assert s.llm_fallback_count == 0
    assert s.fast_path_ratio == 0.0
    assert s.errors == 0
    assert s.pattern_hit_counts == {}


def test_record_fast_path_updates_counts_and_latency():
    m = BoosterMetrics()
    m.record_fast_path(latency_us=100.0, patterns_matched=["EMAIL", "PHONE"])
    m.record_fast_path(latency_us=200.0, patterns_matched=["EMAIL"])

    s = m.snapshot()
    assert s.fast_path_count == 2
    assert s.avg_fast_path_latency_us == pytest.approx(150.0)
    assert s.pattern_hit_counts == {"EMAIL": 2, "PHONE": 1}


def test_record_llm_fallback_tracks_avg():
    m = BoosterMetrics()
    m.record_llm_fallback(latency_us=1000.0)
    m.record_llm_fallback(latency_us=3000.0)

    s = m.snapshot()
    assert s.llm_fallback_count == 2
    assert s.avg_llm_fallback_latency_us == pytest.approx(2000.0)


def test_fast_path_ratio_mixed_traffic():
    m = BoosterMetrics()
    for _ in range(9):
        m.record_fast_path(latency_us=50.0, patterns_matched=["EMAIL"])
    m.record_llm_fallback(latency_us=500.0)

    s = m.snapshot()
    assert s.total_requests == 10
    assert s.fast_path_ratio == pytest.approx(0.9)


def test_errors_counted():
    m = BoosterMetrics()
    m.record_error()
    m.record_error()
    assert m.snapshot().errors == 2


def test_snapshot_returns_independent_copy():
    m = BoosterMetrics()
    m.record_fast_path(latency_us=10.0, patterns_matched=["EMAIL"])
    s1 = m.snapshot()
    m.record_fast_path(latency_us=20.0, patterns_matched=["SSN"])
    # s1 is a frozen copy; new records do not leak
    assert s1.fast_path_count == 1
    assert "SSN" not in s1.pattern_hit_counts


def test_thread_safety():
    m = BoosterMetrics()

    def worker():
        for _ in range(1000):
            m.record_fast_path(latency_us=1.0, patterns_matched=["EMAIL"])

    threads = [threading.Thread(target=worker) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    s = m.snapshot()
    assert s.fast_path_count == 8000
    assert s.pattern_hit_counts["EMAIL"] == 8000


def test_zero_latency_records_do_not_crash_ratio():
    m = BoosterMetrics()
    m.record_fast_path(latency_us=0.0, patterns_matched=[])
    s = m.snapshot()
    assert s.fast_path_count == 1
    assert s.avg_fast_path_latency_us == 0.0


def test_dataclass_default_factories_do_not_share_state():
    a = BoosterMetricsSnapshot()
    b = BoosterMetricsSnapshot()
    a.pattern_hit_counts["EMAIL"] = 5
    assert b.pattern_hit_counts == {}
