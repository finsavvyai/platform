"""Agent Booster -- deterministic transforms that skip LLM calls.

Resolves prompts locally when the answer can be computed without AI:
JSON formatting, math, date/time, unit conversion, UUID, base64.
"""

from __future__ import annotations

import base64
import json
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional

from .math_eval import safe_eval_math


@dataclass
class BoosterRule:
    """A single booster rule with a test predicate and resolver."""

    name: str
    test: Callable[[str], bool]
    resolve: Callable[[str], str]


class Booster:
    """Try to resolve prompts without calling an LLM."""

    def __init__(self) -> None:
        self._rules: list[BoosterRule] = []
        self._register_defaults()

    def try_resolve(self, input_text: str) -> Optional[str]:
        """Try each rule. Return resolved text or None."""
        trimmed = input_text.strip()
        for rule in self._rules:
            if rule.test(trimmed):
                try:
                    return rule.resolve(trimmed)
                except Exception:
                    continue
        return None

    def add_rule(self, rule: BoosterRule) -> None:
        """Register a custom booster rule."""
        self._rules.append(rule)

    @property
    def rule_count(self) -> int:
        return len(self._rules)

    def _register_defaults(self) -> None:
        self._rules.extend([
            self._json_format_rule(),
            self._math_rule(),
            self._date_rule(),
            self._unit_conversion_rule(),
            self._uuid_rule(),
            self._base64_rule(),
        ])

    def _json_format_rule(self) -> BoosterRule:
        def test(inp: str) -> bool:
            lower = inp.lower()
            return (
                lower.startswith("format this json")
                or lower.startswith("pretty print")
            ) and "{" in inp

        def resolve(inp: str) -> str:
            idx = inp.index("{")
            return json.dumps(json.loads(inp[idx:]), indent=2)

        return BoosterRule(name="json-format", test=test, resolve=resolve)

    def _math_rule(self) -> BoosterRule:
        math_pat = re.compile(
            r"^(?:calculate|compute|what is|evaluate|solve)\s+(.+)", re.I
        )
        safe_expr_pat = re.compile(r"^[\d\s+\-*/().,%^]+$")

        def test(inp: str) -> bool:
            m = math_pat.match(inp)
            if not m:
                return False
            return bool(safe_expr_pat.match(m.group(1).strip()))

        def resolve(inp: str) -> str:
            m = math_pat.match(inp)
            assert m is not None
            expr = m.group(1).strip().replace("^", "**")
            result = safe_eval_math(expr)
            if result == int(result):
                return str(int(result))
            return str(result)

        return BoosterRule(name="math", test=test, resolve=resolve)

    def _date_rule(self) -> BoosterRule:
        patterns = [
            re.compile(r"what(?:'s| is) (?:the )?(?:current )?(?:date|time|day)", re.I),
            re.compile(r"(?:today|now|current date)", re.I),
        ]

        def test(inp: str) -> bool:
            return any(p.search(inp) for p in patterns) and len(inp) < 60

        def resolve(_inp: str) -> str:
            return datetime.now(timezone.utc).isoformat()

        return BoosterRule(name="date", test=test, resolve=resolve)

    def _unit_conversion_rule(self) -> BoosterRule:
        pattern = re.compile(r"convert\s+([\d.]+)\s+(\w+)\s+to\s+(\w+)", re.I)
        conversions: dict[str, dict[str, float | Callable[[float], float]]] = {
            "km": {"miles": 0.621371, "m": 1000, "ft": 3280.84},
            "miles": {"km": 1.60934, "m": 1609.34, "ft": 5280},
            "kg": {"lbs": 2.20462, "g": 1000, "oz": 35.274},
            "lbs": {"kg": 0.453592, "g": 453.592, "oz": 16},
            "c": {
                "f": lambda v: v * 9 / 5 + 32,
                "k": lambda v: v + 273.15,
            },
            "f": {
                "c": lambda v: (v - 32) * 5 / 9,
                "k": lambda v: (v - 32) * 5 / 9 + 273.15,
            },
        }

        def test(inp: str) -> bool:
            return bool(pattern.search(inp))

        def resolve(inp: str) -> str:
            m = pattern.search(inp)
            assert m is not None
            value = float(m.group(1))
            from_unit = m.group(2).lower()
            to_unit = m.group(3).lower()
            conv = conversions.get(from_unit, {}).get(to_unit)
            if conv is None:
                raise ValueError("Unknown conversion")
            result = conv(value) if callable(conv) else value * conv
            rounded = round(result, 4)
            # Strip trailing zeros like JS Number()
            formatted = f"{rounded:g}" if rounded != int(rounded) else str(int(rounded))
            return f"{value:g} {from_unit} = {formatted} {to_unit}"

        return BoosterRule(name="unit-conversion", test=test, resolve=resolve)

    def _uuid_rule(self) -> BoosterRule:
        pat = re.compile(r"generate\s+(?:a\s+)?uuid", re.I)

        def test(inp: str) -> bool:
            return bool(pat.search(inp))

        def resolve(_inp: str) -> str:
            return str(uuid.uuid4())

        return BoosterRule(name="uuid", test=test, resolve=resolve)

    def _base64_rule(self) -> BoosterRule:
        encode_pat = re.compile(r"base64\s+encode\s+(.+)", re.I)
        decode_pat = re.compile(r"base64\s+decode\s+(.+)", re.I)

        def test(inp: str) -> bool:
            return bool(encode_pat.search(inp) or decode_pat.search(inp))

        def resolve(inp: str) -> str:
            enc = encode_pat.search(inp)
            if enc:
                return base64.b64encode(enc.group(1).strip().encode()).decode()
            dec = decode_pat.search(inp)
            if dec:
                return base64.b64decode(dec.group(1).strip()).decode("utf-8")
            raise ValueError("No match")

        return BoosterRule(name="base64", test=test, resolve=resolve)
