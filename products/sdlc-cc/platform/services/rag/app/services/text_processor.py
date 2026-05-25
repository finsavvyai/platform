"""
Advanced text cleaning and normalization pipeline for SDLC.ai platform.

This module provides comprehensive text preprocessing including cleaning, normalization,
language detection, and quality assessment for optimal RAG performance.
"""

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import ftfy
import nltk
from langdetect import detect, DetectorFactory
from unidecode import unidecode

# Set seed for consistent language detection
DetectorFactory.seed = 0

logger = logging.getLogger(__name__)


class TextProcessor:
    """Advanced text processing pipeline for document content."""

    def __init__(self):
        self.download_nltk_data()
        self.normalization_patterns = self._init_normalization_patterns()
        self.quality_thresholds = {
            "min_length": 10,
            "min_words": 3,
            "max_repetition_ratio": 0.3,
            "min_alphanumeric_ratio": 0.3,
            "max_special_char_ratio": 0.5,
        }

    def download_nltk_data(self):
        """Download required NLTK data."""
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt')

        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            nltk.download('stopwords')

    def _init_normalization_patterns(self) -> Dict[str, re.Pattern]:
        """Initialize text normalization patterns."""
        return {
            # Whitespace normalization
            "excessive_whitespace": re.compile(r'\s{3,}'),
            "line_breaks": re.compile(r'\r\n|\r'),
            "multiple_spaces": re.compile(r' {2,}'),
            "spacing_around_punctuation": re.compile(r'\s+([.,;:!?)\]])'),

            # Cleanup patterns
            "control_characters": re.compile(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
            "url_patterns": re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+'),
            "email_patterns": re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
            "html_entities": re.compile(r'&[a-zA-Z0-9#]+;'),
            "unicode_quotes": re.compile("[\u201c\u201d\u2018\u2019]"),
            "smart_punctuation": re.compile(r'[–—]'),

            # Repetition patterns
            "repeated_chars": re.compile(r'(.)\1{3,}'),
            "repeated_words": re.compile(r'\b(\w+)(?:\s+\1){2,}\b'),
            "repeated_sentences": re.compile(r'([^.\n]+)(?:\s*\1){2,}'),

            # Document artifacts
            "page_numbers": re.compile(r'\b(?:page|p)\s*\.?\s*\d+\b', re.IGNORECASE),
            "headers_footers": re.compile(r'^(?:header|footer|page\s*\d+|©.*?\d{4})\s*$', re.MULTILINE | re.IGNORECASE),
            "table_of_contents": re.compile(r'^(?:contents?|table\s+of\s+contents?)\s*$', re.MULTILINE | re.IGNORECASE),

            # Numeric patterns
            "standalone_numbers": re.compile(r'\b\d{1,3}\b'),
            "decimal_numbers": re.compile(r'\b\d+\.\d+\b'),
            "phone_numbers": re.compile(r'\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b'),
            "dates": re.compile(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b'),

            # Special characters and formatting
            "brackets_content": re.compile(r'\[[^\]]*\]|\([^)]*\)|\{[^}]*\}'),
            "citation_markers": re.compile(r'\[\d+\]|\(\d{4}\)|\([A-Za-z]+,\s*\d{4}\)'),
            "bullet_points": re.compile(r'^[\s]*[•·▪‣⁃]\s*', re.MULTILINE),
            "numbered_lists": re.compile(r'^[\s]*\d+[.)]\s*', re.MULTILINE),
        }

    async def process_text(
        self,
        text: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process text through the complete cleaning and normalization pipeline.

        Args:
            text: Raw text to process
            options: Processing options

        Returns:
            Dictionary with processed text and metadata
        """
        if not text or not isinstance(text, str):
            return {
                "processed_text": "",
                "original_text": text,
                "language": None,
                "quality_metrics": {},
                "processing_steps": [],
                "errors": ["Invalid input text"]
            }

        start_time = datetime.now()
        processing_steps = []
        errors = []

        try:
            # Step 1: Initial text analysis
            original_metrics = self._analyze_text(text)
            processing_steps.append("initial_analysis")

            # Step 2: Basic text fixing
            text = self._fix_text_issues(text)
            processing_steps.append("text_fixing")

            # Step 3: Remove control characters
            text = self._remove_control_characters(text)
            processing_steps.append("control_character_removal")

            # Step 4: Normalize whitespace
            text = self._normalize_whitespace(text)
            processing_steps.append("whitespace_normalization")

            # Step 5: Normalize punctuation and quotes
            text = self._normalize_punctuation(text)
            processing_steps.append("punctuation_normalization")

            # Step 6: Remove document artifacts
            text = self._remove_document_artifacts(text)
            processing_steps.append("artifact_removal")

            # Step 7: Handle repetitions
            text = self._handle_repetitions(text)
            processing_steps.append("repetition_handling")

            # Step 8: Normalize numeric content
            text = self._normalize_numeric_content(text)
            processing_steps.append("numeric_normalization")

            # Step 9: Extract and preserve entities
            preserved_entities, text = self._extract_preserve_entities(text)
            processing_steps.append("entity_extraction")

            # Step 10: Advanced cleaning
            text = self._advanced_cleaning(text)
            processing_steps.append("advanced_cleaning")

            # Step 11: Restore preserved entities
            text = self._restore_entities(text, preserved_entities)
            processing_steps.append("entity_restoration")

            # Step 12: Final quality checks
            text = self._final_quality_check(text)
            processing_steps.append("final_quality_check")

            # Step 13: Language detection
            language = self._detect_language(text)
            processing_steps.append("language_detection")

            # Step 14: Final analysis
            final_metrics = self._analyze_text(text)
            processing_steps.append("final_analysis")

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return {
                "processed_text": text,
                "original_text": text,
                "language": language,
                "original_metrics": original_metrics,
                "final_metrics": final_metrics,
                "quality_improvement": self._calculate_quality_improvement(original_metrics, final_metrics),
                "preserved_entities": preserved_entities,
                "processing_steps": processing_steps,
                "processing_time_ms": processing_time,
                "errors": errors
            }

        except Exception as e:
            logger.error(f"Text processing failed: {e}")
            errors.append(f"Processing error: {str(e)}")
            return {
                "processed_text": text,
                "original_text": text,
                "language": None,
                "quality_metrics": {},
                "processing_steps": processing_steps,
                "errors": errors
            }

    def _fix_text_issues(self, text: str) -> str:
        """Fix common text encoding and formatting issues."""
        # Fix encoding issues
        text = ftfy.fix_text(text)

        # Normalize Unicode
        text = unidecode(text)

        # Handle HTML entities
        text = self.normalization_patterns["html_entities"].sub(
            lambda m: self._decode_html_entity(m.group()), text
        )

        return text

    def _decode_html_entity(self, entity: str) -> str:
        """Decode HTML entity to character."""
        import html
        try:
            return html.unescape(entity)
        except:
            return entity

    def _remove_control_characters(self, text: str) -> str:
        """Remove control characters while preserving useful formatting."""
        return self.normalization_patterns["control_characters"].sub('', text)

    def _normalize_whitespace(self, text: str) -> str:
        """Normalize whitespace characters."""
        # Normalize line endings
        text = self.normalization_patterns["line_breaks"].sub('\n', text)

        # Remove excessive whitespace
        text = self.normalization_patterns["excessive_whitespace"].sub('  ', text)

        # Normalize multiple spaces
        text = self.normalization_patterns["multiple_spaces"].sub(' ', text)

        # Fix spacing around punctuation
        text = self.normalization_patterns["spacing_around_punctuation"].sub(r'\1', text)

        return text.strip()

    def _normalize_punctuation(self, text: str) -> str:
        """Normalize punctuation and quotation marks."""
        # Normalize Unicode quotes
        text = self.normalization_patterns["unicode_quotes"].sub('"', text)

        # Normalize smart punctuation
        text = self.normalization_patterns["smart_punctuation"].sub('-', text)

        # Ensure consistent spacing around punctuation
        text = re.sub(r'\s*([.,;:!?])\s*', r'\1 ', text)
        text = re.sub(r'\s*\)\s*', ') ', text)
        text = re.sub(r'\s*\(\s*', ' (', text)

        return text.strip()

    def _remove_document_artifacts(self, text: str) -> str:
        """Remove common document artifacts and noise."""
        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            # Skip headers, footers, and page numbers
            if (self.normalization_patterns["page_numbers"].match(line) or
                self.normalization_patterns["headers_footers"].match(line) or
                self.normalization_patterns["table_of_contents"].match(line)):
                continue

            # Skip very short lines that are likely artifacts
            if len(line) < 3 and not re.search(r'[a-zA-Z]', line):
                continue

            cleaned_lines.append(line)

        return '\n\n'.join(cleaned_lines)

    def _handle_repetitions(self, text: str) -> str:
        """Handle excessive repetitions in text."""
        # Fix repeated characters
        text = self.normalization_patterns["repeated_chars"].sub(r'\1\1\1', text)

        # Fix repeated words
        text = self.normalization_patterns["repeated_words"].sub(r'\1', text)

        # Fix repeated sentences
        text = self.normalization_patterns["repeated_sentences"].sub(r'\1', text)

        return text

    def _normalize_numeric_content(self, text: str) -> str:
        """Normalize numeric content while preserving meaning."""
        # Replace phone numbers with placeholder
        text = self.normalization_patterns["phone_numbers"].sub('[PHONE_NUMBER]', text)

        # Replace dates with normalized format
        text = self.normalization_patterns["dates"].sub(
            lambda m: f'[DATE: {m.group()}]', text
        )

        # Handle very long numbers that might be IDs
        text = re.sub(r'\b\d{8,}\b', '[ID_NUMBER]', text)

        return text

    def _extract_preserve_entities(self, text: str) -> Tuple[Dict[str, List[str]], str]:
        """Extract and preserve important entities."""
        entities = {
            "urls": [],
            "emails": [],
            "citations": [],
            "technical_terms": [],
        }

        # Extract URLs
        def replace_url(match):
            url = match.group()
            entities["urls"].append(url)
            return f'[URL_{len(entities["urls"]) - 1}]'

        text = self.normalization_patterns["url_patterns"].sub(replace_url, text)

        # Extract emails
        def replace_email(match):
            email = match.group()
            entities["emails"].append(email)
            return f'[EMAIL_{len(entities["emails"]) - 1}]'

        text = self.normalization_patterns["email_patterns"].sub(replace_email, text)

        # Extract citations
        def replace_citation(match):
            citation = match.group()
            entities["citations"].append(citation)
            return f'[CITATION_{len(entities["citations"]) - 1}]'

        text = self.normalization_patterns["citation_markers"].sub(replace_citation, text)

        return entities, text

    def _restore_entities(self, text: str, entities: Dict[str, List[str]]) -> str:
        """Restore preserved entities to the text."""
        # Restore URLs
        for i, url in enumerate(entities["urls"]):
            text = text.replace(f'[URL_{i}]', url)

        # Restore emails
        for i, email in enumerate(entities["emails"]):
            text = text.replace(f'[EMAIL_{i}]', email)

        # Restore citations
        for i, citation in enumerate(entities["citations"]):
            text = text.replace(f'[CITATION_{i}]', citation)

        return text

    def _advanced_cleaning(self, text: str) -> str:
        """Apply advanced cleaning rules."""
        # Clean up bullet points and numbered lists
        text = self.normalization_patterns["bullet_points"].sub('• ', text)
        text = self.normalization_patterns["numbered_lists"].sub(r'1. ', text)

        # Remove content in brackets if it's short (likely metadata)
        def clean_brackets(match):
            content = match.group()
            if len(content) < 20:  # Short bracketed content
                return ''
            return content

        text = self.normalization_patterns["brackets_content"].sub(clean_brackets, text)

        # Remove standalone numbers (likely page numbers, references)
        text = self.normalization_patterns["standalone_numbers"].sub(
            lambda m: '' if len(m.group()) <= 3 else m.group(), text
        )

        return text

    def _final_quality_check(self, text: str) -> str:
        """Perform final quality checks and adjustments."""
        # Ensure proper paragraph spacing
        text = re.sub(r'([.!?])\s*([A-Z])', r'\1\n\n\2', text)

        # Remove excessive paragraph breaks
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Ensure no trailing whitespace
        text = text.rstrip()

        return text

    def _detect_language(self, text: str) -> Optional[str]:
        """Detect the primary language of the text."""
        try:
            if len(text.strip()) < 50:
                return "unknown"

            # Use only the first 1000 characters for detection
            sample_text = text[:1000]
            language = detect(sample_text)
            return language
        except:
            return "unknown"

    def _analyze_text(self, text: str) -> Dict[str, Any]:
        """Analyze text quality metrics."""
        if not text:
            return {
                "length": 0,
                "word_count": 0,
                "sentence_count": 0,
                "paragraph_count": 0,
                "alphanumeric_ratio": 0.0,
                "special_char_ratio": 0.0,
                "repetition_ratio": 0.0,
                "readability_score": 0.0,
                "quality_score": 0.0
            }

        words = text.split()
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

        # Character analysis
        total_chars = len(text)
        alphanumeric_chars = sum(1 for c in text if c.isalnum())
        special_chars = sum(1 for c in text if not c.isalnum() and not c.isspace())

        # Repetition analysis
        unique_words = len(set(words))
        repetition_ratio = 1.0 - (unique_words / len(words)) if words else 0.0

        # Ratios
        alphanumeric_ratio = alphanumeric_chars / total_chars if total_chars > 0 else 0.0
        special_char_ratio = special_chars / total_chars if total_chars > 0 else 0.0

        # Readability score (simplified)
        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
        readability_score = 1.0 - min(1.0, abs(avg_sentence_length - 15) / 15)  # Optimal: 15 words per sentence

        # Overall quality score
        quality_score = (
            min(1.0, len(words) / 100) * 0.2 +                    # Content volume
            readability_score * 0.3 +                               # Readability
            (1.0 - repetition_ratio) * 0.2 +                        # Uniqueness
            alphanumeric_ratio * 0.1 +                               # Content quality
            (1.0 - special_char_ratio) * 0.2                        # Cleanliness
        )

        return {
            "length": total_chars,
            "word_count": len(words),
            "sentence_count": len(sentences),
            "paragraph_count": len(paragraphs),
            "alphanumeric_ratio": alphanumeric_ratio,
            "special_char_ratio": special_char_ratio,
            "repetition_ratio": repetition_ratio,
            "readability_score": readability_score,
            "quality_score": min(1.0, max(0.0, quality_score))
        }

    def _calculate_quality_improvement(
        self,
        original_metrics: Dict[str, Any],
        final_metrics: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate quality improvement metrics."""
        improvement = {}

        for key in original_metrics:
            if key in final_metrics:
                original_value = original_metrics[key]
                final_value = final_metrics[key]

                if original_value == 0:
                    improvement[key] = final_value
                else:
                    change = (final_value - original_value) / abs(original_value)
                    improvement[key] = change

        return improvement

    def is_text_acceptable(self, text: str, metrics: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Check if text meets quality thresholds."""
        issues = []

        # Check minimum length
        if len(text) < self.quality_thresholds["min_length"]:
            issues.append(f"Text too short: {len(text)} < {self.quality_thresholds['min_length']}")

        # Check minimum word count
        word_count = metrics.get("word_count", 0)
        if word_count < self.quality_thresholds["min_words"]:
            issues.append(f"Too few words: {word_count} < {self.quality_thresholds['min_words']}")

        # Check repetition ratio
        repetition_ratio = metrics.get("repetition_ratio", 0)
        if repetition_ratio > self.quality_thresholds["max_repetition_ratio"]:
            issues.append(f"Too much repetition: {repetition_ratio:.2f} > {self.quality_thresholds['max_repetition_ratio']}")

        # Check alphanumeric ratio
        alphanumeric_ratio = metrics.get("alphanumeric_ratio", 0)
        if alphanumeric_ratio < self.quality_thresholds["min_alphanumeric_ratio"]:
            issues.append(f"Low alphanumeric content: {alphanumeric_ratio:.2f} < {self.quality_thresholds['min_alphanumeric_ratio']}")

        # Check special character ratio
        special_char_ratio = metrics.get("special_char_ratio", 0)
        if special_char_ratio > self.quality_thresholds["max_special_char_ratio"]:
            issues.append(f"Too many special characters: {special_char_ratio:.2f} > {self.quality_thresholds['max_special_char_ratio']}")

        return len(issues) == 0, issues

    def batch_process_texts(
        self,
        texts: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Process multiple texts in batch."""
        results = []

        for text in texts:
            try:
                result = self.process_text(text, options)
                results.append(result)
            except Exception as e:
                logger.error(f"Failed to process text: {e}")
                results.append({
                    "processed_text": text,
                    "original_text": text,
                    "language": None,
                    "quality_metrics": {},
                    "processing_steps": [],
                    "errors": [str(e)]
                })

        return results
