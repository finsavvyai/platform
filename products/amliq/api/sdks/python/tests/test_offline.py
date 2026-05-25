"""Tests for offline screening mode."""

import json
import os
import tempfile
import pytest

from amliq.offline import OfflineScreener


@pytest.fixture
def data_dir():
    with tempfile.TemporaryDirectory() as d:
        entities = [
            {"id": "ent_1", "name": "Vladimir Putin", "list_id": "ofac"},
            {"id": "ent_2", "name": "John Smith", "list_id": "eu"},
            {"id": "ent_3", "name": "Acme Corporation", "list_id": "un"},
        ]
        with open(os.path.join(d, "test.json"), "w") as f:
            json.dump(entities, f)
        yield d


def test_load_lists(data_dir):
    screener = OfflineScreener(data_dir)
    count = screener.load_lists()
    assert count == 3


def test_exact_match(data_dir):
    screener = OfflineScreener(data_dir)
    screener.load_lists()
    results = screener.screen("Vladimir Putin", threshold=0.5)
    assert len(results) >= 1
    assert results[0].matched_name == "Vladimir Putin"


def test_no_match(data_dir):
    screener = OfflineScreener(data_dir)
    screener.load_lists()
    results = screener.screen("Completely Unknown Person", threshold=0.9)
    assert len(results) == 0
