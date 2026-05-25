"""
HTML and web content extractors for SDLC.ai platform.

This module provides comprehensive text extraction from HTML, XML, and web content
with cleaning, normalization, and structure preservation.
"""

import html
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urljoin, urlparse

import chardet
import ftfy
from bs4 import BeautifulSoup, Comment, Tag
from markdown import markdown
from unidecode import unidecode

from ..document_processor import BaseExtractor, ExtractionResult, ProcessingOptions

logger = logging.getLogger(__name__)


class HTMLExtractor(BaseExtractor):
    """High-precision HTML text extraction with structure analysis."""

    def supports_format(self, content_type: str) -> bool:
        """Check if HTML format is supported."""
        return content_type.lower() in [
            "text/html",
            "application/xhtml+xml",
            "text/xml",
            "application/xml",
        ]

    async def extract(
        self, file_data: bytes, options: ProcessingOptions
    ) -> ExtractionResult:
        """Extract text and structure from HTML document."""
        start_time = datetime.now()

        try:
            # Detect encoding
            encoding = self._detect_encoding(file_data)

            # Decode HTML content
            try:
                html_content = file_data.decode(encoding)
            except UnicodeDecodeError:
                # Fallback to UTF-8
                html_content = file_data.decode("utf-8", errors="ignore")

            # Clean and fix HTML
            cleaned_html = self._clean_html(html_content)

            # Parse HTML
            soup = BeautifulSoup(cleaned_html, "html.parser")

            # Extract different content types
            content_parts = []
            metadata = {}
            structure = {}
            tables = []
            pages = []

            # Extract main content
            main_content = self._extract_main_content(soup)
            content_parts.append(main_content["text"])
            structure.update(main_content["structure"])

            # Extract structured data
            structured_data = self._extract_structured_data(soup)
            if structured_data:
                content_parts.append(structured_data)

            # Extract tables
            html_tables = self._extract_html_tables(soup)
            tables.extend(html_tables)
            if html_tables:
                content_parts.append(
                    "\n\n".join(table["text"] for table in html_tables)
                )

            # Extract lists
            lists_content = self._extract_lists(soup)
            if lists_content:
                content_parts.append(lists_content)

            # Extract metadata
            metadata = self._extract_html_metadata(soup, encoding)

            # Combine all content
            full_text = "\n\n".join(filter(None, content_parts))

            # Create page information
            pages = self._create_html_page_info(soup, full_text)

            # Analyze HTML structure
            structure.update(self._analyze_html_structure(soup))

            # Calculate quality metrics
            quality_metrics = self._calculate_html_quality_metrics(full_text, metadata)

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return ExtractionResult(
                text=full_text,
                metadata=metadata,
                pages=pages,
                tables=tables,
                images=[],
                structure=structure,
                quality_metrics=quality_metrics,
                processing_time_ms=processing_time,
                confidence=0.90,
            )

        except Exception as e:
            logger.error(f"HTML extraction failed: {e}")
            raise

    def _detect_encoding(self, file_data: bytes) -> str:
        """Detect HTML encoding."""
        # Try charset detection
        detected = chardet.detect(file_data)
        encoding = detected.get("encoding", "utf-8")

        # Check for HTML charset declaration
        try:
            html_sample = file_data[:5000].decode("utf-8", errors="ignore")
            charset_match = re.search(
                r'charset=([^"\'>\s]+)', html_sample, re.IGNORECASE
            )
            if charset_match:
                encoding = charset_match.group(1)
        except:
            pass

        return encoding or "utf-8"

    def _clean_html(self, html_content: str) -> str:
        """Clean and fix HTML content."""
        # Fix common encoding issues
        cleaned = ftfy.fix_text(html_content)

        # Remove problematic characters
        cleaned = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", cleaned)

        # Fix broken HTML entities
        cleaned = html.unescape(cleaned)

        # Remove script and style content
        cleaned = re.sub(
            r"<script[^>]*>.*?</script>", "", cleaned, flags=re.DOTALL | re.IGNORECASE
        )
        cleaned = re.sub(
            r"<style[^>]*>.*?</style>", "", cleaned, flags=re.DOTALL | re.IGNORECASE
        )

        return cleaned

    def _extract_main_content(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract main content from HTML."""
        structure = {
            "headings": [],
            "sections": [],
            "navigation_elements": [],
            "content_density": 0.0,
        }

        # Remove unwanted elements
        for unwanted in soup.find_all(
            ["script", "style", "nav", "header", "footer", "aside"]
        ):
            unwanted.decompose()

        # Remove comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Extract headings
        for i, heading in enumerate(
            soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
        ):
            if heading.text.strip():
                structure["headings"].append(
                    {
                        "index": i,
                        "level": int(heading.name[1]),
                        "text": heading.text.strip(),
                        "id": heading.get("id", ""),
                    }
                )

        # Find main content area
        main_content = None
        main_candidates = [
            soup.find("main"),
            soup.find("article"),
            soup.find("div", class_=re.compile(r"content|main|article", re.I)),
            soup.find("div", id=re.compile(r"content|main|article", re.I)),
        ]

        for candidate in main_candidates:
            if candidate:
                main_content = candidate
                break

        # Fallback to body if no main content found
        if not main_content:
            main_content = soup.find("body") or soup

        # Extract text with structure preservation
        content_parts = []
        current_section = []
        section_level = 0

        for element in main_content.find_all(
            ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "section", "article"]
        ):
            if element.name.startswith("h"):
                # Save previous section
                if current_section:
                    section_text = "\n".join(current_section)
                    if section_text.strip():
                        content_parts.append(section_text)
                        structure["sections"].append(
                            {
                                "level": section_level,
                                "text": section_text,
                                "length": len(section_text),
                            }
                        )
                    current_section = []

                # Start new section
                section_level = int(element.name[1])
                heading_text = element.text.strip()
                current_section.append(heading_text)

            elif element.name in ["p", "div"]:
                text = self._extract_element_text(element)
                if text.strip():
                    current_section.append(text)

        # Add final section
        if current_section:
            section_text = "\n".join(current_section)
            if section_text.strip():
                content_parts.append(section_text)
                structure["sections"].append(
                    {
                        "level": section_level,
                        "text": section_text,
                        "length": len(section_text),
                    }
                )

        # Calculate content density
        total_text = " ".join(content_parts)
        if len(total_text) > 0:
            meaningful_chars = sum(1 for c in total_text if c.isalnum() or c.isspace())
            structure["content_density"] = meaningful_chars / len(total_text)

        return {"text": "\n\n".join(content_parts), "structure": structure}

    def _extract_element_text(self, element) -> str:
        """Extract text from element while preserving readability."""
        # Handle specific elements
        if element.name in ["br", "hr"]:
            return "\n"
        elif element.name in ["li"]:
            return f"• {element.text.strip()}"
        elif element.name in ["blockquote"]:
            return f'"{element.text.strip()}"'
        elif element.name in ["code"]:
            return f"`{element.text.strip()}`"
        elif element.name in ["pre"]:
            return f"```\n{element.text.strip()}\n```"
        else:
            return element.text.strip()

    def _extract_structured_data(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract structured data (JSON-LD, microdata, etc.)."""
        structured_parts = []

        # Extract JSON-LD
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                import json

                data = json.loads(script.string)
                structured_parts.append(
                    f"Structured Data (JSON-LD): {json.dumps(data, indent=2)}"
                )
            except:
                pass

        # Extract meta tags
        meta_tags = []
        for meta in soup.find_all("meta"):
            name = meta.get("name") or meta.get("property")
            content = meta.get("content")
            if name and content:
                meta_tags.append(f"{name}: {content}")

        if meta_tags:
            structured_parts.append("Metadata:\n" + "\n".join(meta_tags))

        return "\n\n".join(structured_parts) if structured_parts else None

    def _extract_html_tables(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract tables from HTML."""
        tables = []

        for table_idx, table in enumerate(soup.find_all("table")):
            table_data = []
            table_text = []

            # Extract table headers
            headers = []
            header_row = table.find("tr")
            if header_row:
                for th in header_row.find_all(["th", "td"]):
                    headers.append(th.text.strip())

            # Extract table rows
            for row_idx, row in enumerate(table.find_all("tr")):
                row_data = []
                row_text = []

                for cell in row.find_all(["td", "th"]):
                    cell_text = cell.text.strip()
                    row_data.append(cell_text)
                    row_text.append(cell_text)

                if row_data:  # Skip empty rows
                    table_data.append(row_data)
                    table_text.append(" | ".join(row_text))

            if table_data and len(table_data) > 1:
                tables.append(
                    {
                        "table_index": table_idx,
                        "headers": headers,
                        "rows": table_data,
                        "row_count": len(table_data),
                        "col_count": len(headers)
                        if headers
                        else len(table_data[0])
                        if table_data
                        else 0,
                        "text": "\n".join(table_text),
                        "confidence": 0.85,
                    }
                )

        return tables

    def _extract_lists(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract lists from HTML."""
        lists_parts = []

        for list_element in soup.find_all(["ul", "ol"]):
            list_type = "ordered" if list_element.name == "ol" else "unordered"
            list_items = []

            for li in list_element.find_all("li"):
                item_text = li.text.strip()
                if item_text:
                    if list_type == "ordered":
                        list_items.append(f"1. {item_text}")
                    else:
                        list_items.append(f"• {item_text}")

            if list_items:
                lists_parts.append("\n".join(list_items))

        return "\n\n".join(lists_parts) if lists_parts else None

    def _extract_html_metadata(
        self, soup: BeautifulSoup, encoding: str
    ) -> Dict[str, Any]:
        """Extract metadata from HTML document."""
        metadata = {
            "encoding": encoding,
            "title": "",
            "description": "",
            "keywords": "",
            "author": "",
            "language": "",
            "links": [],
            "images": [],
            "forms": 0,
        }

        # Extract title
        title_tag = soup.find("title")
        if title_tag:
            metadata["title"] = title_tag.text.strip()

        # Extract meta tags
        for meta in soup.find_all("meta"):
            name = meta.get("name") or meta.get("property")
            content = meta.get("content")

            if name and content:
                name_lower = name.lower()
                if "description" in name_lower:
                    metadata["description"] = content
                elif "keywords" in name_lower:
                    metadata["keywords"] = content
                elif "author" in name_lower:
                    metadata["author"] = content
                elif "language" in name_lower or "lang" in name_lower:
                    metadata["language"] = content

        # Extract language from html tag
        html_tag = soup.find("html")
        if html_tag and html_tag.get("lang"):
            metadata["language"] = html_tag.get("lang")

        # Extract links
        for link in soup.find_all("a", href=True):
            href = link.get("href")
            text = link.text.strip()
            if href and text:
                metadata["links"].append({"url": href, "text": text})

        # Extract images
        for img in soup.find_all("img", src=True):
            src = img.get("src")
            alt = img.get("alt", "")
            if src:
                metadata["images"].append({"src": src, "alt": alt})

        # Count forms
        metadata["forms"] = len(soup.find_all("form"))

        # Add structural metadata
        metadata.update(
            {
                "heading_count": len(
                    soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])
                ),
                "paragraph_count": len(soup.find_all("p")),
                "table_count": len(soup.find_all("table")),
                "list_count": len(soup.find_all(["ul", "ol"])),
            }
        )

        return metadata

    def _create_html_page_info(
        self, soup: BeautifulSoup, text: str
    ) -> List[Dict[str, Any]]:
        """Create page information for HTML."""
        words = text.split()
        estimated_reading_time = max(1, len(words) // 200)  # ~200 words per minute

        return [
            {
                "page_number": 1,
                "text_length": len(text),
                "word_count": len(words),
                "estimated_reading_time_min": estimated_reading_time,
                "title": soup.find("title").text.strip()
                if soup.find("title")
                else "Untitled",
                "has_content": len(words) > 10,
            }
        ]

    def _analyze_html_structure(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Analyze HTML document structure."""
        structure = {
            "has_semantic_html": False,
            "has_navigation": False,
            "has_header": False,
            "has_footer": False,
            "has_sidebar": False,
            "accessibility_score": 0.0,
            "structure_type": "unknown",
        }

        # Check for semantic HTML5 elements
        semantic_elements = [
            "main",
            "article",
            "section",
            "aside",
            "nav",
            "header",
            "footer",
        ]
        found_semantic = [elem for elem in semantic_elements if soup.find(elem)]
        structure["has_semantic_html"] = len(found_semantic) > 0

        # Check for specific structural elements
        structure["has_navigation"] = bool(soup.find("nav"))
        structure["has_header"] = bool(soup.find("header"))
        structure["has_footer"] = bool(soup.find("footer"))
        structure["has_sidebar"] = bool(soup.find("aside"))

        # Calculate accessibility score
        accessibility_features = [
            bool(soup.find("title")),  # Has title
            bool(soup.find("meta", attrs={"name": "description"})),  # Has description
            bool(soup.find("main")),  # Has main element
            structure["has_semantic_html"],  # Uses semantic HTML
        ]
        structure["accessibility_score"] = sum(accessibility_features) / len(
            accessibility_features
        )

        # Determine structure type
        if structure["has_semantic_html"] and structure["has_navigation"]:
            structure["structure_type"] = "modern_semantic"
        elif structure["has_navigation"] and structure["has_header"]:
            structure["structure_type"] = "traditional_layout"
        elif len(soup.find_all("div")) > 10:
            structure["structure_type"] = "div_based"
        else:
            structure["structure_type"] = "simple"

        return structure

    def _calculate_html_quality_metrics(
        self, text: str, metadata: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate quality metrics for HTML extraction."""
        if not text:
            return {"overall_quality": 0.0}

        metrics = {
            "text_length": len(text),
            "word_count": len(text.split()),
            "readability_score": 0.0,
            "structure_score": 0.0,
            "metadata_completeness": 0.0,
        }

        # Calculate readability score
        sentences = text.split(". ")
        if len(sentences) > 0:
            avg_sentence_length = sum(len(s.split()) for s in sentences) / len(
                sentences
            )
            # Optimal sentence length is 15-20 words
            metrics["readability_score"] = 1.0 - min(
                1.0, abs(avg_sentence_length - 17.5) / 17.5
            )

        # Calculate structure score
        structure_indicators = ["\n\n", "•", "1. ", ":", ";"]
        structure_score = sum(
            1 for indicator in structure_indicators if indicator in text
        ) / len(structure_indicators)
        metrics["structure_score"] = min(1.0, structure_score)

        # Calculate metadata completeness
        metadata_fields = ["title", "description", "language"]
        filled_fields = sum(1 for field in metadata_fields if metadata.get(field))
        metrics["metadata_completeness"] = filled_fields / len(metadata_fields)

        # Overall quality
        metrics["overall_quality"] = (
            min(1.0, metrics["word_count"] / 100) * 0.3  # Content volume
            + metrics["readability_score"] * 0.3  # Readability
            + metrics["structure_score"] * 0.2  # Structure
            + metrics["metadata_completeness"] * 0.2  # Metadata
        )

        return metrics


class MarkdownExtractor(BaseExtractor):
    """Markdown text extraction with structure analysis."""

    def supports_format(self, content_type: str) -> bool:
        """Check if Markdown format is supported."""
        return content_type.lower() in [
            "text/markdown",
            "text/x-markdown",
        ]

    async def extract(
        self, file_data: bytes, options: ProcessingOptions
    ) -> ExtractionResult:
        """Extract text and structure from Markdown document."""
        start_time = datetime.now()

        try:
            # Decode content
            try:
                encoding = chardet.detect(file_data).get("encoding", "utf-8")
                md_content = file_data.decode(encoding)
            except UnicodeDecodeError:
                md_content = file_data.decode("utf-8", errors="ignore")

            # Clean and normalize content
            cleaned_content = self._clean_markdown(md_content)

            # Extract metadata (front matter)
            metadata, content_body = self._extract_frontmatter(cleaned_content)

            # Convert to HTML for structured extraction
            html_content = markdown(
                content_body,
                extensions=[
                    "markdown.extensions.tables",
                    "markdown.extensions.fenced_code",
                    "markdown.extensions.toc",
                    "markdown.extensions.meta",
                ],
            )

            # Parse HTML and extract structure
            soup = BeautifulSoup(html_content, "html.parser")

            # Extract structured content
            structured_content = self._extract_markdown_structure(soup, content_body)

            # Extract tables
            tables = self._extract_markdown_tables(soup)

            # Create page information
            pages = self._create_markdown_page_info(content_body)

            # Analyze document structure
            structure = self._analyze_markdown_structure(content_body)

            # Calculate quality metrics
            quality_metrics = self._calculate_markdown_quality_metrics(
                content_body, metadata
            )

            processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

            return ExtractionResult(
                text=content_body,
                metadata=metadata,
                pages=pages,
                tables=tables,
                images=[],
                structure=structure,
                quality_metrics=quality_metrics,
                processing_time_ms=processing_time,
                confidence=0.95,
            )

        except Exception as e:
            logger.error(f"Markdown extraction failed: {e}")
            raise

    def _clean_markdown(self, content: str) -> str:
        """Clean and normalize Markdown content."""
        # Fix encoding issues
        cleaned = ftfy.fix_text(content)

        # Normalize line endings
        cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")

        # Remove excessive blank lines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

        return cleaned.strip()

    def _extract_frontmatter(self, content: str) -> Tuple[Dict[str, Any], str]:
        """Extract YAML frontmatter from Markdown."""
        metadata = {}
        content_body = content

        # Check for YAML frontmatter
        if content.startswith("---\n"):
            try:
                import yaml

                end_idx = content.find("\n---\n", 4)
                if end_idx != -1:
                    frontmatter_text = content[4:end_idx]
                    metadata = yaml.safe_load(frontmatter_text) or {}
                    content_body = content[end_idx + 5 :]
            except ImportError:
                logger.warning("PyYAML not installed, cannot parse frontmatter")
            except Exception as e:
                logger.warning(f"Failed to parse frontmatter: {e}")

        return metadata, content_body

    def _extract_markdown_structure(
        self, soup: BeautifulSoup, original_content: str
    ) -> Dict[str, Any]:
        """Extract structure from Markdown content."""
        structure = {
            "headings": [],
            "code_blocks": [],
            "links": [],
            "images": [],
        }

        # Extract headings from original content (more accurate)
        heading_pattern = r"^(#{1,6})\s+(.+)$"
        for line_num, line in enumerate(original_content.split("\n")):
            match = re.match(heading_pattern, line)
            if match:
                level = len(match.group(1))
                text = match.group(2).strip()
                structure["headings"].append(
                    {
                        "line_number": line_num,
                        "level": level,
                        "text": text,
                    }
                )

        # Extract code blocks
        code_pattern = r"```(\w+)?\n(.*?)\n```"
        for match in re.finditer(code_pattern, original_content, re.DOTALL):
            language = match.group(1) or "text"
            code = match.group(2)
            structure["code_blocks"].append(
                {
                    "language": language,
                    "code": code,
                    "length": len(code),
                }
            )

        # Extract links
        link_pattern = r"\[([^\]]+)\]\(([^)]+)\)"
        for match in re.finditer(link_pattern, original_content):
            text = match.group(1)
            url = match.group(2)
            structure["links"].append(
                {
                    "text": text,
                    "url": url,
                }
            )

        # Extract images
        image_pattern = r"!\[([^\]]*)\]\(([^)]+)\)"
        for match in re.finditer(image_pattern, original_content):
            alt = match.group(1)
            src = match.group(2)
            structure["images"].append(
                {
                    "alt": alt,
                    "src": src,
                }
            )

        return structure

    def _extract_markdown_tables(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract tables from Markdown (converted to HTML)."""
        tables = []

        for table_idx, table in enumerate(soup.find_all("table")):
            table_data = []
            table_text = []

            # Extract table rows
            for row in table.find_all("tr"):
                row_data = []
                row_text = []

                for cell in row.find_all(["td", "th"]):
                    cell_text = cell.text.strip()
                    row_data.append(cell_text)
                    row_text.append(cell_text)

                if row_data:
                    table_data.append(row_data)
                    table_text.append(" | ".join(row_text))

            if table_data and len(table_data) > 1:
                tables.append(
                    {
                        "table_index": table_idx,
                        "headers": table_data[0] if table_data else [],
                        "rows": table_data,
                        "row_count": len(table_data),
                        "col_count": len(table_data[0]) if table_data else 0,
                        "text": "\n".join(table_text),
                        "confidence": 0.95,
                    }
                )

        return tables

    def _create_markdown_page_info(self, content: str) -> List[Dict[str, Any]]:
        """Create page information for Markdown."""
        words = content.split()
        lines = content.split("\n")

        return [
            {
                "page_number": 1,
                "text_length": len(content),
                "word_count": len(words),
                "line_count": len(lines),
                "has_content": len(words) > 10,
            }
        ]

    def _analyze_markdown_structure(self, content: str) -> Dict[str, Any]:
        """Analyze Markdown document structure."""
        structure = {
            "has_headings": False,
            "has_tables": False,
            "has_code_blocks": False,
            "has_links": False,
            "has_images": False,
            "document_type": "unknown",
        }

        # Check for various Markdown elements
        structure["has_headings"] = bool(
            re.search(r"^#{1,6}\s+", content, re.MULTILINE)
        )
        structure["has_tables"] = bool(re.search(r"\|.*\|", content))
        structure["has_code_blocks"] = bool(re.search(r"```", content))
        structure["has_links"] = bool(re.search(r"\[.*\]\(.*\)", content))
        structure["has_images"] = bool(re.search(r"!\[.*\]\(.*\)", content))

        # Determine document type
        if structure["has_headings"] and structure["has_code_blocks"]:
            structure["document_type"] = "technical_documentation"
        elif structure["has_headings"] and not structure["has_code_blocks"]:
            structure["document_type"] = "structured_document"
        elif structure["has_code_blocks"]:
            structure["document_type"] = "code_documentation"
        else:
            structure["document_type"] = "simple_text"

        return structure

    def _calculate_markdown_quality_metrics(
        self, text: str, metadata: Dict[str, Any]
    ) -> Dict[str, float]:
        """Calculate quality metrics for Markdown extraction."""
        if not text:
            return {"overall_quality": 0.0}

        metrics = {
            "text_length": len(text),
            "word_count": len(text.split()),
            "structure_score": 0.0,
            "formatting_score": 0.0,
            "metadata_completeness": 0.0,
        }

        # Calculate structure score
        structure_elements = [
            bool(re.search(r"^#{1,6}\s+", text, re.MULTILINE)),  # Headings
            bool(re.search(r"\n\n", text)),  # Paragraphs
            bool(re.search(r"^[\-\*]\s+", text, re.MULTILINE)),  # Lists
        ]
        metrics["structure_score"] = sum(structure_elements) / len(structure_elements)

        # Calculate formatting score
        formatting_elements = [
            bool(re.search(r"\*\*.*?\*\*", text)),  # Bold
            bool(re.search(r"\*.*?\*", text)),  # Italic
            bool(re.search(r"`.*?`", text)),  # Inline code
            bool(re.search(r"\[.*\]\(.*\)", text)),  # Links
        ]
        metrics["formatting_score"] = sum(formatting_elements) / len(
            formatting_elements
        )

        # Calculate metadata completeness
        metadata_fields = ["title", "author", "description"]
        filled_fields = sum(1 for field in metadata_fields if metadata.get(field))
        metrics["metadata_completeness"] = filled_fields / len(metadata_fields)

        # Overall quality
        metrics["overall_quality"] = (
            min(1.0, metrics["word_count"] / 100) * 0.4  # Content volume
            + metrics["structure_score"] * 0.3  # Structure
            + metrics["formatting_score"] * 0.2  # Formatting
            + metrics["metadata_completeness"] * 0.1  # Metadata
        )

        return metrics
