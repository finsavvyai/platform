"""Pydantic models for AMLIQ API requests and responses."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class ScreenRequest(BaseModel):
    name: str
    entity_type: Optional[str] = None
    country: Optional[str] = None
    dob: Optional[str] = None
    identifiers: Optional[dict[str, str]] = None


class Evidence(BaseModel):
    layer: str
    algorithm: str
    score: float


class ScreenResult(BaseModel):
    entity_id: str
    matched_name: str
    confidence: float
    list_id: str
    evidence: list[Evidence] = []


class ScreenResponse(BaseModel):
    results: list[ScreenResult] = []
    total: int = 0


class Alert(BaseModel):
    id: str
    entity_name: str
    matched_name: str
    confidence: float
    status: str
    list_id: str


class AlertsResponse(BaseModel):
    alerts: list[Alert] = []
    total: int = 0


class PEPProfile(BaseModel):
    entity_id: str
    tier: int
    position: str
    country: str
    is_active: bool


class MediaHit(BaseModel):
    id: str
    entity_id: str
    category: str
    source: str
    title: str
    url: str
    severity: int
