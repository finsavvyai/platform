"""
Pydantic models for SDLC.ai DLP Service API.

This module defines all Pydantic models for request/response schemas,
data validation, and serialization for the DLP scanning pipeline.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator


class ViolationSeverity(str, Enum):
    """Violation severity levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ViolationStatus(str, Enum):
    """Violation status values."""

    OPEN = "OPEN"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    IGNORED = "IGNORED"


class RuleType(str, Enum):
    """DLP rule types."""

    REGEX = "regex"
    ML = "ml"
    PRESIDIO = "presidio"
    COMPOSITE = "composite"


class ScanStatus(str, Enum):
    """DLP scan status values."""

    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class RiskLevel(str, Enum):
    """Risk assessment levels."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Request Models


class ScanRequest(BaseModel):
    """DLP scan request model."""

    content: str = Field(..., description="Content to scan for DLP violations")
    content_type: Optional[str] = Field(
        "text/plain", description="MIME type of content"
    )
    content_path: Optional[str] = Field(None, description="Path/identifier of content")

    # Scan Configuration
    policies: Optional[List[str]] = Field(
        None, description="Specific policies to apply"
    )
    rules: Optional[List[str]] = Field(None, description="Specific rules to apply")

    # Scan Options
    include_metadata: bool = Field(True, description="Include metadata in results")
    return_context: bool = Field(True, description="Return context around violations")
    max_violations: Optional[int] = Field(
        None, description="Maximum violations to return"
    )

    # Performance Options
    timeout_ms: Optional[int] = Field(None, description="Scan timeout in milliseconds")
    parallel_processing: Optional[bool] = Field(
        None, description="Enable parallel processing"
    )

    class Config:
        schema_extra = {
            "example": {
                "content": "John Smith's email is john.smith@example.com and phone is 555-1234.",
                "content_type": "text/plain",
                "policies": ["pii-policy", "financial-policy"],
                "include_metadata": True,
                "return_context": True,
            }
        }


class BatchScanRequest(BaseModel):
    """Batch DLP scan request model."""

    items: List[ScanRequest] = Field(
        ..., min_items=1, max_items=100, description="Items to scan"
    )

    # Batch Configuration
    batch_id: Optional[str] = Field(None, description="Batch identifier")
    parallel_processing: bool = Field(True, description="Enable parallel processing")
    max_concurrent_scans: int = Field(
        10, ge=1, le=50, description="Maximum concurrent scans"
    )

    # Results Configuration
    aggregate_results: bool = Field(
        True, description="Aggregate results across all items"
    )

    class Config:
        schema_extra = {
            "example": {
                "items": [
                    {
                        "content": "John's email: john@example.com",
                        "content_type": "text/plain",
                    },
                    {"content": "Jane's phone: 555-5678", "content_type": "text/plain"},
                ],
                "parallel_processing": True,
                "aggregate_results": True,
            }
        }


class PolicyCreateRequest(BaseModel):
    """DLP policy creation request model."""

    name: str = Field(..., description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    version: str = Field("1.0.0", description="Policy version")

    # Policy Configuration
    config: Dict[str, Any] = Field(..., description="Policy configuration")
    is_active: bool = Field(True, description="Whether policy is active")
    priority: int = Field(100, ge=1, le=1000, description="Policy priority")

    class Config:
        schema_extra = {
            "example": {
                "name": "PII Detection Policy",
                "description": "Detects personally identifiable information",
                "version": "1.0.0",
                "config": {
                    "entities": ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"],
                    "confidence_threshold": 0.8,
                },
                "is_active": True,
                "priority": 100,
            }
        }


class RuleCreateRequest(BaseModel):
    """DLP rule creation request model."""

    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    rule_type: RuleType = Field(..., description="Rule type")

    # Rule Configuration
    conditions: Dict[str, Any] = Field(..., description="Rule conditions")
    actions: Dict[str, Any] = Field(..., description="Rule actions")

    # Rule Properties
    is_active: bool = Field(True, description="Whether rule is active")
    priority: int = Field(100, ge=1, le=1000, description="Rule priority")
    confidence_threshold: float = Field(
        0.8, ge=0.0, le=1.0, description="Confidence threshold"
    )

    @validator("confidence_threshold")
    def validate_confidence(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence threshold must be between 0.0 and 1.0")
        return v

    class Config:
        schema_extra = {
            "example": {
                "name": "Email Detection Rule",
                "description": "Detects email addresses",
                "rule_type": "regex",
                "conditions": {
                    "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                    "flags": ["IGNORECASE"],
                },
                "actions": {"violation_type": "EMAIL_ADDRESS", "severity": "MEDIUM"},
                "is_active": True,
                "priority": 100,
                "confidence_threshold": 0.9,
            }
        }


class PatternCreateRequest(BaseModel):
    """Regex pattern creation request model."""

    name: str = Field(..., description="Pattern name")
    description: Optional[str] = Field(None, description="Pattern description")
    category: str = Field(..., description="Pattern category")
    subcategory: Optional[str] = Field(None, description="Pattern subcategory")

    # Pattern Configuration
    pattern: str = Field(..., description="Regex pattern")
    flags: Dict[str, bool] = Field(default_factory=dict, description="Regex flags")
    confidence: float = Field(0.9, ge=0.0, le=1.0, description="Pattern confidence")

    @validator("confidence")
    def validate_confidence(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence must be between 0.0 and 1.0")
        return v

    class Config:
        schema_extra = {
            "example": {
                "name": "US Phone Number",
                "description": "Detects US phone numbers",
                "category": "CONTACT_INFO",
                "subcategory": "PHONE",
                "pattern": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
                "flags": {"IGNORECASE": True},
                "confidence": 0.95,
            }
        }


# Response Models


class ViolationInfo(BaseModel):
    """DLP violation information model."""

    id: str = Field(..., description="Violation ID")
    violation_type: str = Field(..., description="Type of violation")
    severity: ViolationSeverity = Field(..., description="Violation severity")
    confidence: float = Field(..., description="Confidence score")

    # Location Information
    content_type: Optional[str] = Field(None, description="Content type")
    content_path: Optional[str] = Field(None, description="Content path")
    line_number: Optional[int] = Field(None, description="Line number")
    column_number: Optional[int] = Field(None, description="Column number")

    # Violation Details
    detected_value: Optional[str] = Field(None, description="Detected value")
    entity_type: Optional[str] = Field(None, description="Entity type")
    pattern_name: Optional[str] = Field(None, description="Pattern name")
    context: Optional[str] = Field(None, description="Context around violation")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    class Config:
        schema_extra = {
            "example": {
                "id": "violation-123",
                "violation_type": "EMAIL_ADDRESS",
                "severity": "MEDIUM",
                "confidence": 0.95,
                "line_number": 1,
                "column_number": 15,
                "detected_value": "john.smith@example.com",
                "entity_type": "EMAIL_ADDRESS",
                "pattern_name": "Email Pattern",
                "context": "John Smith's email is john.smith@example.com",
                "metadata": {"rule_id": "rule-123"},
            }
        }


class ScanMetadata(BaseModel):
    """DLP scan metadata model."""

    scan_id: str = Field(..., description="Unique scan identifier")
    tenant_id: str = Field(..., description="Tenant ID")
    content_type: Optional[str] = Field(None, description="Content type")
    content_size_bytes: int = Field(..., description="Content size in bytes")

    # Timing Information
    scan_duration_ms: int = Field(
        ..., description="Total scan duration in milliseconds"
    )
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")

    # Scan Configuration
    policies_applied: List[str] = Field(
        default_factory=list, description="Applied policies"
    )
    rules_applied: List[str] = Field(default_factory=list, description="Applied rules")

    # Performance Metrics
    items_processed: int = Field(..., description="Number of items processed")
    cache_hits: int = Field(default=0, description="Number of cache hits")

    # Additional Metadata
    additional_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class ScanResult(BaseModel):
    """DLP scan result model."""

    scan_id: str = Field(..., description="Scan identifier")
    status: ScanStatus = Field(..., description="Scan status")

    # Violation Summary
    total_violations: int = Field(..., description="Total number of violations")
    violations_by_severity: Dict[ViolationSeverity, int] = Field(
        ..., description="Violations by severity"
    )
    violations_by_type: Dict[str, int] = Field(..., description="Violations by type")

    # Risk Assessment
    risk_score: float = Field(..., description="Overall risk score")
    risk_level: RiskLevel = Field(..., description="Risk level")

    # Violations
    violations: List[ViolationInfo] = Field(..., description="List of violations")

    # Metadata
    metadata: ScanMetadata = Field(..., description="Scan metadata")

    class Config:
        schema_extra = {
            "example": {
                "scan_id": "scan-123",
                "status": "COMPLETED",
                "total_violations": 2,
                "violations_by_severity": {"MEDIUM": 2},
                "violations_by_type": {"EMAIL_ADDRESS": 1, "PHONE_NUMBER": 1},
                "risk_score": 0.75,
                "risk_level": "MEDIUM",
                "violations": [
                    {
                        "id": "violation-1",
                        "violation_type": "EMAIL_ADDRESS",
                        "severity": "MEDIUM",
                        "confidence": 0.95,
                        "detected_value": "john.smith@example.com",
                        "entity_type": "EMAIL_ADDRESS",
                    }
                ],
                "metadata": {
                    "scan_id": "scan-123",
                    "tenant_id": "tenant-123",
                    "content_size_bytes": 1024,
                    "scan_duration_ms": 150,
                    "processing_time_ms": 120,
                    "items_processed": 1,
                },
            }
        }


class BatchScanResult(BaseModel):
    """Batch DLP scan result model."""

    batch_id: Optional[str] = Field(None, description="Batch identifier")
    status: ScanStatus = Field(..., description="Overall batch status")

    # Summary
    total_items: int = Field(..., description="Total number of items")
    completed_items: int = Field(..., description="Number of completed items")
    failed_items: int = Field(..., description="Number of failed items")

    # Aggregated Results
    total_violations: int = Field(..., description="Total violations across all items")
    violations_by_severity: Dict[ViolationSeverity, int] = Field(
        ..., description="Violations by severity"
    )
    violations_by_type: Dict[str, int] = Field(..., description="Violations by type")

    # Results
    results: List[ScanResult] = Field(..., description="Individual scan results")

    # Performance
    total_duration_ms: int = Field(..., description="Total batch duration")

    class Config:
        schema_extra = {
            "example": {
                "batch_id": "batch-123",
                "status": "COMPLETED",
                "total_items": 2,
                "completed_items": 2,
                "failed_items": 0,
                "total_violations": 2,
                "violations_by_severity": {"MEDIUM": 2},
                "violations_by_type": {"EMAIL_ADDRESS": 1, "PHONE_NUMBER": 1},
                "results": [],
                "total_duration_ms": 300,
            }
        }


class PolicyInfo(BaseModel):
    """DLP policy information model."""

    id: str = Field(..., description="Policy ID")
    name: str = Field(..., description="Policy name")
    description: Optional[str] = Field(None, description="Policy description")
    version: str = Field(..., description="Policy version")
    is_active: bool = Field(..., description="Whether policy is active")
    priority: int = Field(..., description="Policy priority")

    # Configuration
    config: Dict[str, Any] = Field(..., description="Policy configuration")

    # Metadata
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator")

    # Rule Count
    rule_count: int = Field(..., description="Number of rules in policy")

    class Config:
        schema_extra = {
            "example": {
                "id": "policy-123",
                "name": "PII Detection Policy",
                "description": "Detects personally identifiable information",
                "version": "1.0.0",
                "is_active": True,
                "priority": 100,
                "config": {"entities": ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"]},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "created_by": "admin@example.com",
                "rule_count": 3,
            }
        }


class RuleInfo(BaseModel):
    """DLP rule information model."""

    id: str = Field(..., description="Rule ID")
    name: str = Field(..., description="Rule name")
    description: Optional[str] = Field(None, description="Rule description")
    rule_type: RuleType = Field(..., description="Rule type")
    is_active: bool = Field(..., description="Whether rule is active")
    priority: int = Field(..., description="Rule priority")
    confidence_threshold: float = Field(..., description="Confidence threshold")

    # Configuration
    conditions: Dict[str, Any] = Field(..., description="Rule conditions")
    actions: Dict[str, Any] = Field(..., description="Rule actions")

    # Metadata
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator")

    # Policy Information
    policy_id: str = Field(..., description="Parent policy ID")
    policy_name: str = Field(..., description="Parent policy name")

    class Config:
        schema_extra = {
            "example": {
                "id": "rule-123",
                "name": "Email Detection Rule",
                "description": "Detects email addresses",
                "rule_type": "regex",
                "is_active": True,
                "priority": 100,
                "confidence_threshold": 0.9,
                "conditions": {
                    "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
                },
                "actions": {"violation_type": "EMAIL_ADDRESS", "severity": "MEDIUM"},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "created_by": "admin@example.com",
                "policy_id": "policy-123",
                "policy_name": "PII Detection Policy",
            }
        }


class PatternInfo(BaseModel):
    """Regex pattern information model."""

    id: str = Field(..., description="Pattern ID")
    name: str = Field(..., description="Pattern name")
    description: Optional[str] = Field(None, description="Pattern description")
    category: str = Field(..., description="Pattern category")
    subcategory: Optional[str] = Field(None, description="Pattern subcategory")

    # Pattern Configuration
    pattern: str = Field(..., description="Regex pattern")
    flags: Dict[str, bool] = Field(default_factory=dict, description="Regex flags")
    confidence: float = Field(..., description="Pattern confidence")

    # Metadata
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    created_by: Optional[str] = Field(None, description="Creator")

    # Usage Statistics
    usage_count: int = Field(default=0, description="Number of times pattern was used")
    effectiveness_score: Optional[float] = Field(
        None, description="Pattern effectiveness score"
    )

    class Config:
        schema_extra = {
            "example": {
                "id": "pattern-123",
                "name": "US Phone Number",
                "description": "Detects US phone numbers",
                "category": "CONTACT_INFO",
                "subcategory": "PHONE",
                "pattern": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
                "flags": {"IGNORECASE": True},
                "confidence": 0.95,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
                "created_by": "admin@example.com",
                "usage_count": 150,
                "effectiveness_score": 0.92,
            }
        }


# Error Response Models


class ErrorDetail(BaseModel):
    """Error detail model."""

    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional error details"
    )
    field: Optional[str] = Field(None, description="Field associated with error")


class ErrorResponse(BaseModel):
    """Standard error response model."""

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: Optional[List[ErrorDetail]] = Field(None, description="Error details")
    timestamp: datetime = Field(
        default_factory=datetime.utcnow, description="Error timestamp"
    )
    request_id: Optional[str] = Field(None, description="Request ID for tracing")

    class Config:
        schema_extra = {
            "example": {
                "error": "ValidationError",
                "message": "Invalid request parameters",
                "details": [
                    {
                        "code": "INVALID_REGEX",
                        "message": "Invalid regex pattern",
                        "field": "pattern",
                    }
                ],
                "timestamp": "2024-01-01T00:00:00Z",
                "request_id": "req-123",
            }
        }


# Pagination Models


class PaginatedResponse(BaseModel):
    """Paginated response model."""

    items: List[Any] = Field(..., description="List of items")
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Page size")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")

    class Config:
        schema_extra = {
            "example": {
                "items": [],
                "total": 100,
                "page": 1,
                "page_size": 20,
                "total_pages": 5,
                "has_next": True,
                "has_prev": False,
            }
        }
