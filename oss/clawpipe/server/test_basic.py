#!/usr/bin/env python3
"""Compatibility wrapper for legacy `python3 test_basic.py` command."""

from runpy import run_path
from pathlib import Path

ROOT = Path(__file__).resolve().parent
run_path(str(ROOT / "tests" / "test_basic.py"), run_name="__main__")
