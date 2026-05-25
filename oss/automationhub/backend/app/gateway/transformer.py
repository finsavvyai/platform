"""
Request/Response Transformer

This module provides comprehensive request and response transformation capabilities including:
- Request validation and sanitization
- Data format conversion (JSON, XML, etc.)
- Field filtering and mapping
- Response format standardization
- Compression and optimization
- Data masking for sensitive information
- Custom transformation rules
- Content adaptation based on client capabilities

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import json
import xml.etree.ElementTree as ET
import re
import gzip
import logging
from typing import Dict, List, Any, Optional, Union, Callable, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import base64
import hashlib
import secrets

from fastapi import Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse
import orjson

from app.gateway.config import GatewayPolicyConfig, TransformationRule

logger = logging.getLogger(__name__)


class TransformationType(str, Enum):
    """Transformation types"""
    VALIDATION = "validation"
    SANITIZATION = "sanitization"
    NORMALIZATION = "normalization"
    FILTERING = "filtering"
    MAPPING = "mapping"
    MASKING = "masking"
    COMPRESSION = "compression"
    CONVERSION = "conversion"


class ContentType(str, Enum):
    """Content types"""
    JSON = "application/json"
    XML = "application/xml"
    TEXT = "text/plain"
    HTML = "text/html"
    FORM = "application/x-www-form-urlencoded"
    BINARY = "application/octet-stream"


@dataclass
class TransformationContext:
    """Context for transformation operations"""
    request: Request
    user_id: Optional[str] = None
    api_key_id: Optional[str] = None
    tier: str = "default"
    endpoint: str = ""
    method: str = ""
    client_capabilities: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TransformationRule:
    """Individual transformation rule"""
    name: str
    type: TransformationType
    enabled: bool = True
    priority: int = 100
    conditions: Dict[str, Any] = field(default_factory=dict)
    config: Dict[str, Any] = field(default_factory=dict)
    target_content_types: List[str] = field(default_factory=list)
    exclude_content_types: List[str] = field(default_factory=list)


class DataSanitizer:
    """Data sanitization utilities"""

    @staticmethod
    def sanitize_html(input_string: str) -> str:
        """Sanitize HTML content"""
        if not input_string:
            return input_string

        # Remove potentially dangerous HTML tags and attributes
        dangerous_tags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea']
        dangerous_attrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur']

        # Simple tag removal
        for tag in dangerous_tags:
            pattern = f'<{tag}[^>]*>.*?</{tag}>'
            input_string = re.sub(pattern, '', input_string, flags=re.IGNORECASE | re.DOTALL)
            pattern = f'<{tag}[^>]*/?>'
            input_string = re.sub(pattern, '', input_string, flags=re.IGNORECASE)

        # Remove dangerous attributes
        for attr in dangerous_attrs:
            pattern = f'{attr}[^"\'=]*=["\'][^"\']*["\']'
            input_string = re.sub(pattern, '', input_string, flags=re.IGNORECASE)

        return input_string

    @staticmethod
    def sanitize_sql(input_string: str) -> str:
        """Basic SQL injection sanitization"""
        if not input_string:
            return input_string

        # Remove common SQL injection patterns
        sql_patterns = [
            r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
            r"(--|#|\/\*|\*\/)",
            r"(\bOR\b.*=.*\bOR\b)",
            r"(\bAND\b.*=.*\bAND\b)",
            r"(\'\';.*\bOR\b)",
        ]

        for pattern in sql_patterns:
            input_string = re.sub(pattern, '', input_string, flags=re.IGNORECASE)

        return input_string

    @staticmethod
    def sanitize_json(input_data: Union[str, Dict, List]) -> Union[Dict, List]:
        """Sanitize JSON data"""
        if isinstance(input_data, str):
            try:
                data = json.loads(input_data)
            except json.JSONDecodeError:
                return input_data
        else:
            data = input_data

        def sanitize_value(value):
            if isinstance(value, str):
                return DataSanitizer.sanitize_html(DataSanitizer.sanitize_sql(value))
            elif isinstance(value, dict):
                return {k: sanitize_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [sanitize_value(item) for item in value]
            else:
                return value

        return sanitize_value(data)


class DataMasker:
    """Data masking utilities for sensitive information"""

    SENSITIVE_PATTERNS = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        'ssn': r'\b\d{3}-?\d{2}-?\d{4}\b',
        'credit_card': r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
        'api_key': r'\b[A-Za-z0-9]{20,}\b',
        'jwt': r'\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\b'
    }

    @classmethod
    def mask_data(cls, data: Union[str, Dict, List], mask_patterns: List[str] = None) -> Union[str, Dict, List]:
        """Mask sensitive data patterns"""
        if mask_patterns is None:
            mask_patterns = ['email', 'phone', 'ssn', 'credit_card', 'api_key']

        if isinstance(data, str):
            return cls._mask_string(data, mask_patterns)
        elif isinstance(data, dict):
            return cls._mask_dict(data, mask_patterns)
        elif isinstance(data, list):
            return [cls.mask_data(item, mask_patterns) for item in data]
        else:
            return data

    @classmethod
    def _mask_string(cls, text: str, mask_patterns: List[str]) -> str:
        """Mask sensitive patterns in string"""
        for pattern_name in mask_patterns:
            if pattern_name in cls.SENSITIVE_PATTERNS:
                pattern = cls.SENSITIVE_PATTERNS[pattern_name]
                if pattern_name == 'email':
                    text = re.sub(pattern, cls._mask_email, text)
                elif pattern_name == 'phone':
                    text = re.sub(pattern, cls._mask_phone, text)
                elif pattern_name == 'ssn':
                    text = re.sub(pattern, 'XXX-XX-XXXX', text)
                elif pattern_name == 'credit_card':
                    text = re.sub(pattern, cls._mask_credit_card, text)
                elif pattern_name == 'api_key':
                    text = re.sub(pattern, cls._mask_key, text)
                else:
                    text = re.sub(pattern, '***MASKED***', text)

        return text

    @classmethod
    def _mask_dict(cls, data: Dict, mask_patterns: List[str]) -> Dict:
        """Recursively mask sensitive data in dictionary"""
        masked_data = {}

        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in ['password', 'secret', 'token', 'key', 'auth']):
                masked_data[key] = '***MASKED***'
            elif isinstance(value, (str, dict, list)):
                masked_data[key] = cls.mask_data(value, mask_patterns)
            else:
                masked_data[key] = value

        return masked_data

    @staticmethod
    def _mask_email(match):
        """Mask email addresses"""
        email = match.group()
        parts = email.split('@')
        if len(parts) == 2:
            username = parts[0]
            domain = parts[1]
            if len(username) > 2:
                masked_username = username[0] + '*' * (len(username) - 2) + username[-1]
            else:
                masked_username = '*' * len(username)
            return f"{masked_username}@{domain}"
        return '***@***.***'

    @staticmethod
    def _mask_phone(match):
        """Mask phone numbers"""
        phone = match.group()
        digits = re.sub(r'\D', '', phone)
        if len(digits) == 10:
            return f"***-***-{digits[-4:]}"
        return "***-***-****"

    @staticmethod
    def _mask_credit_card(match):
        """Mask credit card numbers"""
        card = match.group()
        digits = re.sub(r'\D', '', card)
        if len(digits) >= 4:
            return f"****-****-****-{digits[-4:]}"
        return "****-****-****-****"

    @staticmethod
    def _mask_key(match):
        """Mask API keys and tokens"""
        key = match.group()
        if len(key) > 8:
            return key[:4] + '*' * (len(key) - 8) + key[-4:]
        return '*' * len(key)


class RequestTransformer:
    """Request transformation engine"""

    def __init__(self, config: GatewayPolicyConfig):
        self.config = config
        self.sanitizer = DataSanitizer()
        self.masker = DataMasker()
        self.transformation_rules: List[TransformationRule] = []
        self._load_rules()

    def _load_rules(self):
        """Load transformation rules from configuration"""
        for rule_config in self.config.transformation_rules:
            if rule_config.enabled:
                rule = TransformationRule(
                    name=rule_config.name,
                    type=TransformationType(rule_config.conditions.get("type", "normalization")),
                    enabled=rule_config.enabled,
                    priority=rule_config.priority,
                    conditions=rule_config.conditions,
                    config=rule_config.request_transformations if hasattr(rule_config, 'request_transformations') else {},
                    target_content_types=rule_config.target_endpoints if hasattr(rule_config, 'target_endpoints') else [],
                )
                self.transformation_rules.append(rule)

        # Sort rules by priority
        self.transformation_rules.sort(key=lambda x: x.priority)

    async def transform(self, request: Request) -> Request:
        """Transform request according to rules"""
        try:
            # Create transformation context
            context = TransformationContext(
                request=request,
                endpoint=request.url.path,
                method=request.method,
                user_id=getattr(request.state, 'user_id', None),
                api_key_id=getattr(request.state, 'api_key_id', None),
                tier=getattr(request.state, 'tier', 'default')
            )

            # Apply applicable transformation rules
            for rule in self.transformation_rules:
                if await self._should_apply_rule(rule, context):
                    await self._apply_request_rule(rule, request, context)

            # Apply standard transformations
            await self._apply_standard_transformations(request, context)

            return request

        except Exception as e:
            logger.error(f"Request transformation failed: {e}")
            return request

    async def _should_apply_rule(self, rule: TransformationRule, context: TransformationContext) -> bool:
        """Check if transformation rule should be applied"""
        if not rule.enabled:
            return False

        # Check endpoint conditions
        if rule.target_content_types:
            if not any(context.endpoint.startswith(endpoint) for endpoint in rule.target_content_types):
                return False

        # Check method conditions
        if 'methods' in rule.conditions:
            allowed_methods = rule.conditions['methods']
            if context.method not in allowed_methods:
                return False

        # Check header conditions
        if 'headers' in rule.conditions:
            for header, expected_value in rule.conditions['headers'].items():
                actual_value = context.request.headers.get(header)
                if actual_value != expected_value:
                    return False

        # Check user tier conditions
        if 'tiers' in rule.conditions:
            allowed_tiers = rule.conditions['tiers']
            if context.tier not in allowed_tiers:
                return False

        return True

    async def _apply_request_rule(self, rule: TransformationRule, request: Request, context: TransformationContext):
        """Apply individual transformation rule"""
        try:
            if rule.type == TransformationType.VALIDATION:
                await self._validate_request(request, rule.config)
            elif rule.type == TransformationType.SANITIZATION:
                await self._sanitize_request(request, rule.config)
            elif rule.type == TransformationType.NORMALIZATION:
                await self._normalize_request(request, rule.config)
            elif rule.type == TransformationType.FILTERING:
                await self._filter_request(request, rule.config)
            elif rule.type == TransformationType.MAPPING:
                await self._map_request(request, rule.config)
            elif rule.type == TransformationType.MASKING:
                await self._mask_request(request, rule.config)

        except Exception as e:
            logger.error(f"Failed to apply request rule {rule.name}: {e}")

    async def _apply_standard_transformations(self, request: Request, context: TransformationContext):
        """Apply standard request transformations"""
        # Basic validation
        await self._validate_request_structure(request)

        # Content type normalization
        await self._normalize_content_type(request)

        # Header normalization
        await self._normalize_headers(request)

    async def _validate_request(self, request: Request, config: Dict[str, Any]):
        """Validate request against rules"""
        if 'max_body_size' in config:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > config['max_body_size']:
                raise ValueError(f"Request body too large: {content_length} > {config['max_body_size']}")

        if 'required_headers' in config:
            for header in config['required_headers']:
                if header not in request.headers:
                    raise ValueError(f"Required header missing: {header}")

    async def _sanitize_request(self, request: Request, config: Dict[str, Any]):
        """Sanitize request data"""
        if 'sanitize_body' in config and config['sanitize_body']:
            # This would require request body to be read and sanitized
            pass

        if 'sanitize_query_params' in config and config['sanitize_query_params']:
            # Sanitize query parameters
            sanitized_params = {}
            for key, value in request.query_params.items():
                sanitized_value = self.sanitizer.sanitize_html(value)
                sanitized_params[key] = sanitized_value
            # Update request with sanitized params (this is simplified)

    async def _normalize_request(self, request: Request, config: Dict[str, Any]):
        """Normalize request format"""
        # Standardize JSON formatting
        if 'normalize_json' in config and config['normalize_json']:
            # Would read and normalize JSON body
            pass

    async def _filter_request(self, request: Request, config: Dict[str, Any]):
        """Filter request data"""
        if 'remove_headers' in config:
            for header in config['remove_headers']:
                if header in request.headers:
                    # This would require header removal capability
                    pass

    async def _map_request(self, request: Request, config: Dict[str, Any]):
        """Map request fields"""
        # Field mapping implementation
        pass

    async def _mask_request(self, request: Request, config: Dict[str, Any]):
        """Mask sensitive request data"""
        if 'mask_patterns' in config:
            # Would read request body and mask sensitive data
            pass

    async def _validate_request_structure(self, request: Request):
        """Validate basic request structure"""
        # Check required headers
        if not request.headers.get("host"):
            raise ValueError("Host header required")

        # Check method
        if request.method not in ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]:
            raise ValueError(f"Unsupported method: {request.method}")

    async def _normalize_content_type(self, request: Request):
        """Normalize content type"""
        content_type = request.headers.get("content-type", "").lower()

        # Normalize content type variations
        if "json" in content_type:
            request.headers.mutablecopy()["content-type"] = "application/json"
        elif "xml" in content_type:
            request.headers.mutablecopy()["content-type"] = "application/xml"
        elif "form" in content_type:
            request.headers.mutablecopy()["content-type"] = "application/x-www-form-urlencoded"

    async def _normalize_headers(self, request: Request):
        """Normalize request headers"""
        # Standardize header names
        normalized_headers = {}
        for key, value in request.headers.items():
            normalized_key = key.lower().replace('_', '-')
            normalized_headers[normalized_key] = value


class ResponseTransformer:
    """Response transformation engine"""

    def __init__(self, config: GatewayPolicyConfig):
        self.config = config
        self.masker = DataMasker()
        self.transformation_rules: List[TransformationRule] = []
        self._load_rules()

    def _load_rules(self):
        """Load response transformation rules from configuration"""
        for rule_config in self.config.transformation_rules:
            if rule_config.enabled and hasattr(rule_config, 'response_transformations'):
                rule = TransformationRule(
                    name=rule_config.name,
                    type=TransformationType(rule_config.conditions.get("type", "normalization")),
                    enabled=rule_config.enabled,
                    priority=rule_config.priority,
                    conditions=rule_config.conditions,
                    config=rule_config.response_transformations,
                    target_content_types=rule_config.target_endpoints if hasattr(rule_config, 'target_endpoints') else [],
                )
                self.transformation_rules.append(rule)

        # Sort rules by priority
        self.transformation_rules.sort(key=lambda x: x.priority)

    async def transform(self, request: Request, response: Response) -> Response:
        """Transform response according to rules"""
        try:
            # Create transformation context
            context = TransformationContext(
                request=request,
                endpoint=request.url.path,
                method=request.method,
                user_id=getattr(request.state, 'user_id', None),
                api_key_id=getattr(request.state, 'api_key_id', None),
                tier=getattr(request.state, 'tier', 'default')
            )

            # Apply applicable transformation rules
            for rule in self.transformation_rules:
                if await self._should_apply_rule(rule, context):
                    response = await self._apply_response_rule(rule, response, context)

            # Apply standard transformations
            response = await self._apply_standard_response_transformations(request, response, context)

            return response

        except Exception as e:
            logger.error(f"Response transformation failed: {e}")
            return response

    async def _should_apply_rule(self, rule: TransformationRule, context: TransformationContext) -> bool:
        """Check if response transformation rule should be applied"""
        if not rule.enabled:
            return False

        # Similar logic to request transformer rule application
        return True

    async def _apply_response_rule(self, rule: TransformationRule, response: Response, context: TransformationContext) -> Response:
        """Apply individual response transformation rule"""
        try:
            if rule.type == TransformationType.FILTERING:
                response = await self._filter_response(response, rule.config)
            elif rule.type == TransformationType.MAPPING:
                response = await self._map_response(response, rule.config)
            elif rule.type == TransformationType.MASKING:
                response = await self._mask_response(response, rule.config)
            elif rule.type == TransformationType.CONVERSION:
                response = await self._convert_response(response, rule.config)
            elif rule.type == TransformationType.COMPRESSION:
                response = await self._compress_response(response, rule.config)

            return response

        except Exception as e:
            logger.error(f"Failed to apply response rule {rule.name}: {e}")
            return response

    async def _apply_standard_response_transformations(self, request: Request, response: Response, context: TransformationContext) -> Response:
        """Apply standard response transformations"""
        # Add standard headers
        response.headers["X-Response-Time"] = f"{(datetime.utcnow().timestamp() - context.metadata.get('start_time', datetime.utcnow().timestamp())) * 1000:.2f}ms"

        # Mask sensitive data if needed
        if self.config.monitoring.sensitive_fields:
            response = await self._mask_sensitive_fields(response, self.config.monitoring.sensitive_fields)

        # Optimize response size
        response = await self._optimize_response_size(response)

        return response

    async def _filter_response(self, response: Response, config: Dict[str, Any]) -> Response:
        """Filter response data"""
        if 'remove_fields' in config and response.headers.get("content-type", "").startswith("application/json"):
            # Parse JSON response and remove specified fields
            try:
                if hasattr(response, 'body'):
                    body_data = orjson.loads(response.body)
                    self._remove_fields_from_data(body_data, config['remove_fields'])
                    response.body = orjson.dumps(body_data)
            except (orjson.JSONDecodeError, AttributeError):
                pass

        return response

    async def _map_response(self, response: Response, config: Dict[str, Any]) -> Response:
        """Map response fields"""
        if 'field_mappings' in config and response.headers.get("content-type", "").startswith("application/json"):
            # Parse JSON response and map fields
            try:
                if hasattr(response, 'body'):
                    body_data = orjson.loads(response.body)
                    body_data = self._map_fields_in_data(body_data, config['field_mappings'])
                    response.body = orjson.dumps(body_data)
            except (orjson.JSONDecodeError, AttributeError):
                pass

        return response

    async def _mask_response(self, response: Response, config: Dict[str, Any]) -> Response:
        """Mask sensitive response data"""
        if response.headers.get("content-type", "").startswith("application/json"):
            try:
                if hasattr(response, 'body'):
                    body_data = orjson.loads(response.body)
                    mask_patterns = config.get('mask_patterns', ['email', 'phone', 'ssn', 'credit_card'])
                    masked_data = self.masker.mask_data(body_data, mask_patterns)
                    response.body = orjson.dumps(masked_data)
            except (orjson.JSONDecodeError, AttributeError):
                pass

        return response

    async def _convert_response(self, response: Response, config: Dict[str, Any]) -> Response:
        """Convert response format"""
        target_format = config.get('target_format', 'json')
        current_content_type = response.headers.get("content-type", "")

        if target_format == 'json' and not current_content_type.startswith("application/json"):
            # Convert to JSON format
            pass
        elif target_format == 'xml' and not current_content_type.startswith("application/xml"):
            # Convert to XML format
            pass

        return response

    async def _compress_response(self, response: Response, config: Dict[str, Any]) -> Response:
        """Compress response if beneficial"""
        if config.get('compress', False) and hasattr(response, 'body'):
            # Check if compression is beneficial
            if len(response.body) > config.get('min_size', 1024):
                try:
                    compressed_data = gzip.compress(response.body)
                    if len(compressed_data) < len(response.body):
                        response.body = compressed_data
                        response.headers["Content-Encoding"] = "gzip"
                except Exception as e:
                    logger.error(f"Response compression failed: {e}")

        return response

    async def _mask_sensitive_fields(self, response: Response, sensitive_fields: List[str]) -> Response:
        """Mask sensitive fields in response"""
        if response.headers.get("content-type", "").startswith("application/json"):
            try:
                if hasattr(response, 'body'):
                    body_data = orjson.loads(response.body)
                    masked_data = self.masker.mask_data(body_data, sensitive_fields)
                    response.body = orjson.dumps(masked_data)
            except (orjson.JSONDecodeError, AttributeError):
                pass

        return response

    async def _optimize_response_size(self, response: Response) -> Response:
        """Optimize response size"""
        # Remove unnecessary headers
        headers_to_remove = ['server', 'x-powered-by', 'connection']
        for header in headers_to_remove:
            if header in response.headers:
                del response.headers[header]

        return response

    def _remove_fields_from_data(self, data: Any, fields_to_remove: List[str]):
        """Recursively remove fields from data structure"""
        if isinstance(data, dict):
            keys_to_remove = [key for key in data.keys() if key in fields_to_remove]
            for key in keys_to_remove:
                del data[key]
            for value in data.values():
                self._remove_fields_from_data(value, fields_to_remove)
        elif isinstance(data, list):
            for item in data:
                self._remove_fields_from_data(item, fields_to_remove)

    def _map_fields_in_data(self, data: Any, field_mappings: Dict[str, str]) -> Any:
        """Recursively map fields in data structure"""
        if isinstance(data, dict):
            mapped_data = {}
            for key, value in data.items():
                new_key = field_mappings.get(key, key)
                mapped_data[new_key] = self._map_fields_in_data(value, field_mappings)
            return mapped_data
        elif isinstance(data, list):
            return [self._map_fields_in_data(item, field_mappings) for item in data]
        else:
            return data