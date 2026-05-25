"""
Presidio PII Detection Integration for SDLC.ai DLP Service.

This module provides comprehensive PII detection capabilities using Microsoft Presidio,
including custom recognizers, multi-language support, and performance optimization.
"""

import logging
import re
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import spacy
from presidio_analyzer import (
    AnalyzerEngine,
    EntityRecognizer,
    Pattern,
    RecognizerRegistry,
    RecognizerResult,
)
from presidio_anonymizer import AnonymizerConfig, AnonymizerEngine

from app.core.config import get_presidio_settings
from app.models.schemas import ViolationInfo, ViolationSeverity

logger = logging.getLogger(__name__)


class PresidioEntityType(StrEnum):
    """Supported Presidio entity types."""

    # Basic PII
    PERSON = "PERSON"
    EMAIL_ADDRESS = "EMAIL_ADDRESS"
    PHONE_NUMBER = "PHONE_NUMBER"
    LOCATION = "LOCATION"
    DATE_TIME = "DATE_TIME"

    # Financial Information
    IBAN_CODE = "IBAN_CODE"
    CREDIT_CARD = "CREDIT_CARD"
    US_BANK_NUMBER = "US_BANK_NUMBER"

    # Identification Documents
    US_SSN = "US_SSN"
    US_DRIVER_LICENSE = "US_DRIVER_LICENSE"
    US_PASSPORT = "US_PASSPORT"
    US_ITIN = "US_ITIN"
    UK_NHS = "UK_NHS"

    # Regional Identifiers
    AU_ABN = "AU_ABN"
    AU_ACN = "AU_ACN"
    AU_TFN = "AU_TFN"
    AU_MEDICARE = "AU_MEDICARE"
    SG_NRIC_FIN = "SG_NRIC_FIN"

    # Indian Identifiers
    IN_PAN = "IN_PAN"
    IN_AADHAAR = "IN_AADHAAR"
    IN_VOTER = "IN_VOTER"
    IN_PASSPORT = "IN_PASSPORT"
    IN_DRIVING_LICENSE = "IN_DRIVING_LICENSE"

    # Network and Technical
    IP_ADDRESS = "IP_ADDRESS"
    URL = "URL"
    NRP = "NRP"  # National Registration Number

    # Custom Entity Types
    MEDICAL_RECORD = "MEDICAL_RECORD"
    LEGAL_DOCUMENT = "LEGAL_DOCUMENT"
    CONFIDENTIAL_CODE = "CONFIDENTIAL_CODE"


@dataclass
class PIIExtractionResult:
    """Result of PII extraction from content."""

    entities: list[RecognizerResult]
    anonymized_text: str | None
    risk_score: float
    processing_time_ms: int
    language: str | None
    entity_counts: dict[str, int]
    confidence_scores: dict[str, float]


class CustomRecognizer(EntityRecognizer, ABC):
    """Base class for custom PII recognizers."""

    def __init__(
        self,
        name: str,
        supported_language: str = "en",
        confidence: float = 0.85,
        supported_entities: list[str] = None,
    ):
        super().__init__(
            name=name,
            supported_language=supported_language,
            confidence=confidence,
            supported_entities=supported_entities or [],
        )

    @abstractmethod
    def analyze(
        self, text: str, entities: list[str], nlp_artifacts: dict[str, Any]
    ) -> list[RecognizerResult]:
        """Analyze text for PII entities."""
        pass


class MedicalRecordRecognizer(CustomRecognizer):
    """Custom recognizer for medical record numbers."""

    # Medical record patterns
    PATTERNS = [
        # MRN formats: MRN-XXXXX, MED-XXXXX, etc.
        r"\b(?:MRN|MED|REC|PAT)-?\d{4,8}\b",
        # Medical record numbers with letters and numbers
        r"\b[A-Z]{2,4}\d{6,8}\b",
        # Hospital ID patterns
        r"\bHID-?\d{6,10}\b",
    ]

    def __init__(self, confidence: float = 0.8):
        super().__init__(
            name="MedicalRecordRecognizer",
            supported_entities=[PresidioEntityType.MEDICAL_RECORD],
            confidence=confidence,
        )
        self.patterns = [
            Pattern(name=f"medical_record_{i}", regex=pattern, score=confidence)
            for i, pattern in enumerate(self.PATTERNS)
        ]

    def analyze(
        self, text: str, entities: list[str], nlp_artifacts: dict[str, Any]
    ) -> list[RecognizerResult]:
        """Analyze text for medical record numbers."""
        results = []

        if PresidioEntityType.MEDICAL_RECORD not in entities:
            return results

        for pattern in self.patterns:
            matches = re.finditer(pattern.regex, text, re.IGNORECASE)
            for match in matches:
                start, end = match.span()
                result = RecognizerResult(
                    entity_type=PresidioEntityType.MEDICAL_RECORD,
                    start=start,
                    end=end,
                    score=pattern.score,
                    recognizer_name=self.name,
                )
                results.append(result)

        return results


class LegalDocumentRecognizer(CustomRecognizer):
    """Custom recognizer for legal document identifiers."""

    PATTERNS = [
        # Case numbers: 2024-CV-00123
        r"\b\d{4}-(?:CV|CR|CA|CT)-\d{5}\b",
        # File numbers: FILE-2024-001
        r"\bFILE-\d{4}-\d{3}\b",
        # Document numbers: DOC-2024-12345
        r"\bDOC-\d{4}-\d{5}\b",
        # Court docket numbers
        r"\bDOCKET-\d{2,4}-\d{4,6}\b",
    ]

    def __init__(self, confidence: float = 0.85):
        super().__init__(
            name="LegalDocumentRecognizer",
            supported_entities=[PresidioEntityType.LEGAL_DOCUMENT],
            confidence=confidence,
        )
        self.patterns = [
            Pattern(name=f"legal_document_{i}", regex=pattern, score=confidence)
            for i, pattern in enumerate(self.PATTERNS)
        ]

    def analyze(
        self, text: str, entities: list[str], nlp_artifacts: dict[str, Any]
    ) -> list[RecognizerResult]:
        """Analyze text for legal document identifiers."""
        results = []

        if PresidioEntityType.LEGAL_DOCUMENT not in entities:
            return results

        for pattern in self.patterns:
            matches = re.finditer(pattern.regex, text, re.IGNORECASE)
            for match in matches:
                start, end = match.span()
                result = RecognizerResult(
                    entity_type=PresidioEntityType.LEGAL_DOCUMENT,
                    start=start,
                    end=end,
                    score=pattern.score,
                    recognizer_name=self.name,
                )
                results.append(result)

        return results


class ConfidentialCodeRecognizer(CustomRecognizer):
    """Custom recognizer for confidential codes and identifiers."""

    PATTERNS = [
        # Confidential markings
        r"\bCONFIDENTIAL[-_]?CODE[:\s]?\w{6,12}\b",
        r"\bSECRET[-_]?ID[:\s]?\w{8,16}\b",
        r"\bCLASSIFIED[-_]?REF[:\s]?\w{6,10}\b",
        # Project codes
        r"\bPROJECT[-_]?CODE[:\s]?\w{6,8}\b",
        r"\bCLIENT[-_]?REF[:\s]?\w{8,12}\b",
        # Access codes
        r"\bACCESS[-_]?CODE[:\s]?\w{8,16}\b",
        r"\bAUTH[-_]?TOKEN[:\s]?\w{16,64}\b",
    ]

    def __init__(self, confidence: float = 0.9):
        super().__init__(
            name="ConfidentialCodeRecognizer",
            supported_entities=[PresidioEntityType.CONFIDENTIAL_CODE],
            confidence=confidence,
        )
        self.patterns = [
            Pattern(name=f"confidential_code_{i}", regex=pattern, score=confidence)
            for i, pattern in enumerate(self.PATTERNS)
        ]

    def analyze(
        self, text: str, entities: list[str], nlp_artifacts: dict[str, Any]
    ) -> list[RecognizerResult]:
        """Analyze text for confidential codes."""
        results = []

        if PresidioEntityType.CONFIDENTIAL_CODE not in entities:
            return results

        for pattern in self.patterns:
            matches = re.finditer(pattern.regex, text, re.IGNORECASE)
            for match in matches:
                start, end = match.span()
                result = RecognizerResult(
                    entity_type=PresidioEntityType.CONFIDENTIAL_CODE,
                    start=start,
                    end=end,
                    score=pattern.score,
                    recognizer_name=self.name,
                )
                results.append(result)

        return results


class PresidioPIIDetector:
    """Main PII detection service using Presidio."""

    def __init__(self):
        self.settings = get_presidio_settings()
        self.analyzer = None
        self.anonymizer = None
        self.nlp_models = {}
        self._initialize()

    def _initialize(self):
        """Initialize Presidio analyzer and anonymizer."""
        try:
            # Initialize recognizer registry
            registry = RecognizerRegistry()

            # Load built-in recognizers
            registry.load_predefined_recognizers()

            # Add custom recognizers
            self._add_custom_recognizers(registry)

            # Initialize analyzer
            self.analyzer = AnalyzerEngine(registry=registry)

            # Initialize anonymizer
            self.anonymizer = AnonymizerEngine()

            # Load NLP models for supported languages
            self._load_nlp_models()

            logger.info("Presidio PII detector initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Presidio PII detector: {e}")
            raise

    def _add_custom_recognizers(self, registry: RecognizerRegistry):
        """Add custom recognizers to the registry."""
        try:
            # Add medical record recognizer
            registry.add_recognizer(MedicalRecordRecognizer())

            # Add legal document recognizer
            registry.add_recognizer(LegalDocumentRecognizer())

            # Add confidential code recognizer
            registry.add_recognizer(ConfidentialCodeRecognizer())

            logger.info("Custom recognizers added successfully")

        except Exception as e:
            logger.error(f"Failed to add custom recognizers: {e}")
            raise

    def _load_nlp_models(self):
        """Load NLP models for supported languages."""
        try:
            for lang in self.settings.presidio_languages:
                model_name = f"{lang}_core_web_lg"
                try:
                    nlp = spacy.load(model_name)
                    self.nlp_models[lang] = nlp
                    logger.info(f"Loaded spaCy model: {model_name}")
                except OSError:
                    # Fallback to smaller model
                    model_name = f"{lang}_core_web_sm"
                    try:
                        nlp = spacy.load(model_name)
                        self.nlp_models[lang] = nlp
                        logger.warning(f"Loaded fallback spaCy model: {model_name}")
                    except OSError:
                        logger.error(f"Could not load spaCy model for language: {lang}")

        except Exception as e:
            logger.error(f"Failed to load NLP models: {e}")

    async def extract_pii(
        self,
        text: str,
        language: str | None = None,
        entities: list[str] | None = None,
        confidence_threshold: float | None = None,
        return_anonymized: bool = False,
        anonymizer_config: dict[str, Any] | None = None,
    ) -> PIIExtractionResult:
        """Extract PII entities from text using Presidio."""

        start_time = time.time()

        try:
            # Set defaults
            language = language or self.settings.default_language
            entities = entities or self.settings.supported_entities
            confidence_threshold = (
                confidence_threshold or self.settings.presidio_confidence_threshold
            )

            # Configure anonymizer if requested
            anonymizer_cfg = None
            if return_anonymized and anonymizer_config:
                anonymizer_cfg = AnonymizerConfig(**anonymizer_config)

            # Analyze text
            results = self.analyzer.analyze(
                text=text,
                language=language,
                entities=entities,
                score_threshold=confidence_threshold,
                return_decision_process=True,
            )

            # Filter results by confidence threshold
            filtered_results = [
                result for result in results if result.score >= confidence_threshold
            ]

            # Anonymize text if requested
            anonymized_text = None
            if return_anonymized and anonymizer_cfg:
                anonymized_result = self.anonymizer.anonymize(
                    text=text,
                    analyzer_results=filtered_results,
                    anonymizer_config=anonymizer_cfg,
                )
                anonymized_text = anonymized_result.text

            # Calculate statistics
            entity_counts = {}
            confidence_scores = {}

            for result in filtered_results:
                entity_type = result.entity_type
                entity_counts[entity_type] = entity_counts.get(entity_type, 0) + 1
                confidence_scores[entity_type] = (
                    confidence_scores.get(entity_type, 0) + result.score
                )

            # Average confidence scores
            for entity_type in confidence_scores:
                confidence_scores[entity_type] /= entity_counts[entity_type]

            # Calculate risk score
            risk_score = self._calculate_risk_score(filtered_results)

            processing_time = int((time.time() - start_time) * 1000)

            return PIIExtractionResult(
                entities=filtered_results,
                anonymized_text=anonymized_text,
                risk_score=risk_score,
                processing_time_ms=processing_time,
                language=language,
                entity_counts=entity_counts,
                confidence_scores=confidence_scores,
            )

        except Exception as e:
            logger.error(f"PII extraction failed: {e}")
            raise

    def _calculate_risk_score(self, entities: list[RecognizerResult]) -> float:
        """Calculate risk score based on detected entities."""

        if not entities:
            return 0.0

        # Risk weights by entity type
        risk_weights = {
            PresidioEntityType.US_SSN: 1.0,
            PresidioEntityType.CREDIT_CARD: 0.9,
            PresidioEntityType.IBAN_CODE: 0.9,
            PresidioEntityType.EMAIL_ADDRESS: 0.7,
            PresidioEntityType.PHONE_NUMBER: 0.6,
            PresidioEntityType.PERSON: 0.5,
            PresidioEntityType.LOCATION: 0.4,
            PresidioEntityType.DATE_TIME: 0.3,
            PresidioEntityType.MEDICAL_RECORD: 1.0,
            PresidioEntityType.LEGAL_DOCUMENT: 0.8,
            PresidioEntityType.CONFIDENTIAL_CODE: 0.9,
        }

        # Calculate weighted risk score
        total_risk = 0.0
        for entity in entities:
            weight = risk_weights.get(entity.entity_type, 0.5)
            confidence = entity.score
            total_risk += weight * confidence

        # Normalize to 0-1 range
        max_possible_risk = len(
            entities
        )  # Maximum if all entities have weight 1.0 and confidence 1.0
        risk_score = (
            min(1.0, total_risk / max_possible_risk) if max_possible_risk > 0 else 0.0
        )

        return risk_score

    def convert_to_violations(
        self,
        results: PIIExtractionResult,
        content: str,
        scan_id: str,
        tenant_id: str,
    ) -> list[ViolationInfo]:
        """Convert Presidio results to violation objects."""

        violations = []

        for entity in results.entities:
            # Determine severity based on entity type and confidence
            severity = self._determine_severity(entity.entity_type, entity.score)

            # Extract detected value
            start, end = entity.start, entity.end
            detected_value = content[start:end]

            # Create violation
            violation = ViolationInfo(
                id=f"{scan_id}-{entity.start}-{entity.end}",
                violation_type=entity.entity_type,
                severity=severity,
                confidence=entity.score,
                content_type="text/plain",
                line_number=self._get_line_number(content, start),
                column_number=self._get_column_number(content, start),
                detected_value=detected_value,
                entity_type=entity.entity_type,
                pattern_name=entity.recognizer_name,
                context=self._get_context(content, start, end),
                metadata={
                    "scan_id": scan_id,
                    "tenant_id": tenant_id,
                    "recognizer_name": entity.recognizer_name,
                    "language": results.language,
                },
            )

            violations.append(violation)

        return violations

    def _determine_severity(
        self, entity_type: str, confidence: float
    ) -> ViolationSeverity:
        """Determine violation severity based on entity type and confidence."""

        # High-risk entities
        high_risk_entities = {
            PresidioEntityType.US_SSN,
            PresidioEntityType.CREDIT_CARD,
            PresidioEntityType.IBAN_CODE,
            PresidioEntityType.MEDICAL_RECORD,
            PresidioEntityType.CONFIDENTIAL_CODE,
        }

        # Medium-risk entities
        medium_risk_entities = {
            PresidioEntityType.EMAIL_ADDRESS,
            PresidioEntityType.PHONE_NUMBER,
            PresidioEntityType.LEGAL_DOCUMENT,
        }

        # Determine severity
        if entity_type in high_risk_entities and confidence >= 0.8:
            return ViolationSeverity.CRITICAL
        elif entity_type in high_risk_entities:
            return ViolationSeverity.HIGH
        elif entity_type in medium_risk_entities and confidence >= 0.8:
            return ViolationSeverity.HIGH
        elif entity_type in medium_risk_entities:
            return ViolationSeverity.MEDIUM
        else:
            return ViolationSeverity.LOW

    def _get_line_number(self, text: str, position: int) -> int | None:
        """Get line number for a character position."""
        try:
            lines_before = text[:position].count("\n")
            return lines_before + 1
        except:
            return None

    def _get_column_number(self, text: str, position: int) -> int | None:
        """Get column number for a character position."""
        try:
            last_newline = text.rfind("\n", 0, position)
            if last_newline == -1:
                return position + 1
            else:
                return position - last_newline
        except:
            return None

    def _get_context(
        self, text: str, start: int, end: int, context_size: int = 50
    ) -> str:
        """Get context around a detected entity."""
        try:
            context_start = max(0, start - context_size)
            context_end = min(len(text), end + context_size)

            context = text[context_start:context_end]

            # Add ellipsis if context is truncated
            if context_start > 0:
                context = "..." + context
            if context_end < len(text):
                context = context + "..."

            return context.strip()

        except:
            return ""

    async def batch_extract_pii(
        self,
        texts: list[str],
        language: str | None = None,
        entities: list[str] | None = None,
        confidence_threshold: float | None = None,
        max_concurrent: int = 10,
    ) -> list[PIIExtractionResult]:
        """Extract PII from multiple texts in batches."""

        import asyncio

        if not texts:
            return []

        # Create semaphore to limit concurrent processing
        semaphore = asyncio.Semaphore(max_concurrent)

        async def extract_single_pii(text: str) -> PIIExtractionResult:
            async with semaphore:
                return await self.extract_pii(
                    text=text,
                    language=language,
                    entities=entities,
                    confidence_threshold=confidence_threshold,
                )

        # Process texts concurrently
        tasks = [extract_single_pii(text) for text in texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions and return successful results
        successful_results = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Batch PII extraction failed: {result}")
            else:
                successful_results.append(result)

        return successful_results

    def get_supported_entities(self) -> list[str]:
        """Get list of supported entity types."""
        return self.settings.supported_entities

    def get_supported_languages(self) -> list[str]:
        """Get list of supported languages."""
        return list(self.nlp_models.keys())

    def is_entity_supported(self, entity_type: str) -> bool:
        """Check if an entity type is supported."""
        return entity_type in self.settings.supported_entities

    def is_language_supported(self, language: str) -> bool:
        """Check if a language is supported."""
        return language in self.nlp_models


# Singleton instance
_presidio_detector = None


def get_presidio_detector() -> PresidioPIIDetector:
    """Get singleton instance of Presidio PII detector."""
    global _presidio_detector
    if _presidio_detector is None:
        _presidio_detector = PresidioPIIDetector()
    return _presidio_detector
