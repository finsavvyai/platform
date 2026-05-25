"""
Import/Export Engine for Multi-Database Manager

This module provides unified import/export functionality across different database types
and file formats, with progress tracking and error handling.
"""

import os
import json
import csv
import xml.etree.ElementTree as ET
import mimetypes
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional, Callable, Union, Iterator
from pathlib import Path
from enum import Enum
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class FileFormat(Enum):
    """Supported file formats for import/export"""
    SQL = "sql"
    CSV = "csv"
    JSON = "json"
    XML = "xml"
    EXCEL = "excel"
    POSTGRESQL_DUMP = "pg_dump"
    MYSQL_DUMP = "mysql_dump"
    MONGODB_JSON = "mongodb_json"
    MONGODB_BSON = "mongodb_bson"
    REDIS_RDB = "redis_rdb"
    REDIS_AOF = "redis_aof"
    UNKNOWN = "unknown"


@dataclass
class ImportOptions:
    """Configuration options for import operations"""
    ignore_errors: bool = False
    batch_size: int = 1000
    progress_callback: Optional[Callable[[int, str], None]] = None
    transformations: List[Dict[str, Any]] = field(default_factory=list)
    encoding: str = "utf-8"
    delimiter: str = ","
    quote_char: str = '"'
    escape_char: str = "\\"
    skip_header: bool = True
    target_table: Optional[str] = None
    create_table: bool = False
    truncate_table: bool = False


@dataclass
class ExportOptions:
    """Configuration options for export operations"""
    format: FileFormat = FileFormat.CSV
    include_headers: bool = True
    batch_size: int = 1000
    progress_callback: Optional[Callable[[int, str], None]] = None
    encoding: str = "utf-8"
    delimiter: str = ","
    quote_char: str = '"'
    compression: Optional[str] = None
    pretty_print: bool = True


@dataclass
class ImportResult:
    """Result of an import operation"""
    success: bool
    records_processed: int = 0
    records_imported: int = 0
    records_failed: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExportResult:
    """Result of an export operation"""
    success: bool
    records_exported: int = 0
    file_size: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    execution_time: float = 0.0
    output_file: Optional[str] = None


@dataclass
class ValidationResult:
    """Result of data validation"""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    row_errors: Dict[int, List[str]] = field(default_factory=dict)


class ProgressTracker:
    """Tracks progress of import/export operations"""
    
    def __init__(self, callback: Optional[Callable[[int, str], None]] = None):
        self.callback = callback
        self.current_progress = 0
        self.current_message = ""
        self.total_steps = 100
    
    def update(self, progress: int, message: str = ""):
        """Update progress and notify callback"""
        self.current_progress = min(max(progress, 0), 100)
        self.current_message = message
        
        if self.callback:
            self.callback(self.current_progress, self.current_message)
        
        logger.debug(f"Progress: {self.current_progress}% - {self.current_message}")
    
    def increment(self, amount: int = 1, message: str = ""):
        """Increment progress by amount"""
        self.update(self.current_progress + amount, message)


class FormatDetector:
    """Detects file formats for import/export operations"""
    
    def __init__(self):
        try:
            import magic
            self.magic_mime = magic.Magic(mime=True)
            self.magic_type = magic.Magic()
            self.has_magic = True
        except ImportError:
            logger.warning("python-magic not available, using fallback detection methods")
            self.magic_mime = None
            self.magic_type = None
            self.has_magic = False
    
    def detect_format(self, file_path: str) -> FileFormat:
        """Detect file format based on extension, content, and magic bytes"""
        path = Path(file_path)
        
        # First try by extension
        format_by_ext = self._detect_by_extension(path.suffix.lower())
        if format_by_ext != FileFormat.UNKNOWN:
            # Verify with content analysis
            if self._verify_format_by_content(file_path, format_by_ext):
                return format_by_ext
        
        # Try by MIME type if magic is available
        if self.has_magic:
            try:
                mime_type = self.magic_mime.from_file(file_path)
                format_by_mime = self._detect_by_mime_type(mime_type)
                if format_by_mime != FileFormat.UNKNOWN:
                    return format_by_mime
            except Exception as e:
                logger.warning(f"Failed to detect MIME type: {e}")
        else:
            # Fallback to mimetypes module
            try:
                mime_type, _ = mimetypes.guess_type(file_path)
                if mime_type:
                    format_by_mime = self._detect_by_mime_type(mime_type)
                    if format_by_mime != FileFormat.UNKNOWN:
                        return format_by_mime
            except Exception as e:
                logger.warning(f"Failed to guess MIME type: {e}")
        
        # Try by content analysis
        return self._detect_by_content_analysis(file_path)
    
    def _detect_by_extension(self, extension: str) -> FileFormat:
        """Detect format by file extension"""
        extension_map = {
            '.sql': FileFormat.SQL,
            '.csv': FileFormat.CSV,
            '.json': FileFormat.JSON,
            '.xml': FileFormat.XML,
            '.xlsx': FileFormat.EXCEL,
            '.xls': FileFormat.EXCEL,
            '.dump': FileFormat.POSTGRESQL_DUMP,
            '.bson': FileFormat.MONGODB_BSON,
            '.rdb': FileFormat.REDIS_RDB,
            '.aof': FileFormat.REDIS_AOF,
        }
        return extension_map.get(extension, FileFormat.UNKNOWN)
    
    def _detect_by_mime_type(self, mime_type: str) -> FileFormat:
        """Detect format by MIME type"""
        mime_map = {
            'text/csv': FileFormat.CSV,
            'application/json': FileFormat.JSON,
            'text/xml': FileFormat.XML,
            'application/xml': FileFormat.XML,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileFormat.EXCEL,
            'application/vnd.ms-excel': FileFormat.EXCEL,
        }
        return mime_map.get(mime_type, FileFormat.UNKNOWN)
    
    def _verify_format_by_content(self, file_path: str, expected_format: FileFormat) -> bool:
        """Verify format by analyzing file content"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                first_lines = [f.readline().strip() for _ in range(5)]
                content_start = ''.join(first_lines)
            
            if expected_format == FileFormat.SQL:
                sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']
                return any(keyword in content_start.upper() for keyword in sql_keywords)
            
            elif expected_format == FileFormat.JSON:
                return content_start.startswith(('{', '['))
            
            elif expected_format == FileFormat.XML:
                return content_start.startswith('<?xml') or content_start.startswith('<')
            
            elif expected_format == FileFormat.CSV:
                # Check if it looks like CSV (has delimiters, reasonable structure)
                return ',' in content_start or ';' in content_start or '\t' in content_start
            
            return True
            
        except Exception:
            return False
    
    def _detect_by_content_analysis(self, file_path: str) -> FileFormat:
        """Detect format by analyzing file content"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                first_chunk = f.read(1024)
            
            # Check for JSON
            if first_chunk.strip().startswith(('{', '[')):
                try:
                    json.loads(first_chunk)
                    return FileFormat.JSON
                except:
                    pass
            
            # Check for XML
            if first_chunk.strip().startswith(('<?xml', '<')):
                try:
                    ET.fromstring(first_chunk)
                    return FileFormat.XML
                except:
                    pass
            
            # Check for SQL
            sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']
            if any(keyword in first_chunk.upper() for keyword in sql_keywords):
                return FileFormat.SQL
            
            # Check for CSV (has delimiters and structured data)
            if ',' in first_chunk or ';' in first_chunk or '\t' in first_chunk:
                lines = first_chunk.split('\n')[:5]
                if len(lines) > 1:
                    # Check if lines have similar structure
                    delimiters = [line.count(',') for line in lines if line.strip()]
                    if delimiters and len(set(delimiters)) <= 2:  # Allow some variation
                        return FileFormat.CSV
            
            return FileFormat.UNKNOWN
            
        except Exception as e:
            logger.warning(f"Content analysis failed: {e}")
            return FileFormat.UNKNOWN


class FormatHandler(ABC):
    """Abstract base class for format-specific handlers"""
    
    @abstractmethod
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse file and yield records"""
        pass
    
    @abstractmethod
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write data to file"""
        pass
    
    @abstractmethod
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate data format and structure"""
        pass


class CSVFormatHandler(FormatHandler):
    """Handler for CSV format files"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse CSV file and yield records"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # Detect dialect
                sample = f.read(1024)
                f.seek(0)
                
                try:
                    dialect = csv.Sniffer().sniff(sample)
                except:
                    dialect = csv.excel
                
                reader = csv.DictReader(f, dialect=dialect)
                
                total_size = os.path.getsize(file_path)
                processed_size = 0
                
                for row_num, row in enumerate(reader, 1):
                    # Update progress based on row count (since f.tell() doesn't work with csv.DictReader)
                    if row_num % 100 == 0:  # Update progress every 100 rows
                        progress.update(min(90, row_num // 10), f"Processing row {row_num}")
                    
                    # Clean and yield row
                    cleaned_row = {k.strip(): v.strip() if v else None for k, v in row.items()}
                    yield cleaned_row
                
                progress.update(100, f"CSV parsing complete: {row_num} rows processed")
                    
        except Exception as e:
            logger.error(f"Error parsing CSV file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write data to CSV file"""
        try:
            first_record = next(data)
            fieldnames = list(first_record.keys())
            
            with open(file_path, 'w', newline='', encoding=options.encoding) as f:
                writer = csv.DictWriter(
                    f, 
                    fieldnames=fieldnames,
                    delimiter=options.delimiter,
                    quotechar=options.quote_char
                )
                
                if options.include_headers:
                    writer.writeheader()
                
                writer.writerow(first_record)
                
                row_count = 1
                for row in data:
                    writer.writerow(row)
                    row_count += 1
                    
                    if row_count % 1000 == 0:
                        progress.update(
                            min(90, (row_count // 1000) * 10), 
                            f"Written {row_count} records"
                        )
                
                progress.update(100, f"Export complete: {row_count} records")
                
        except Exception as e:
            logger.error(f"Error writing CSV file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate CSV data structure"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        row_errors = {}
        
        # Check for consistent column structure
        first_row_keys = set(data[0].keys())
        for i, row in enumerate(data[1:], 1):
            row_keys = set(row.keys())
            if row_keys != first_row_keys:
                row_errors[i] = [f"Inconsistent columns: expected {first_row_keys}, got {row_keys}"]
        
        # Check for empty values
        empty_count = sum(1 for row in data for value in row.values() if not value)
        if empty_count > len(data) * len(first_row_keys) * 0.1:  # More than 10% empty
            warnings.append(f"High number of empty values: {empty_count}")
        
        return ValidationResult(
            valid=len(errors) == 0 and len(row_errors) == 0,
            errors=errors,
            warnings=warnings,
            row_errors=row_errors
        )


class JSONFormatHandler(FormatHandler):
    """Handler for JSON format files"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse JSON file and yield records"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                progress.update(10, "Loading JSON file")
                data = json.load(f)
                
                progress.update(30, "Processing JSON data")
                
                if isinstance(data, list):
                    total_records = len(data)
                    for i, record in enumerate(data):
                        progress_pct = 30 + int((i / total_records) * 60)
                        progress.update(progress_pct, f"Processing record {i + 1}/{total_records}")
                        
                        if isinstance(record, dict):
                            yield record
                        else:
                            # Convert non-dict items to dict
                            yield {"value": record}
                
                elif isinstance(data, dict):
                    progress.update(90, "Processing single JSON object")
                    yield data
                
                else:
                    progress.update(90, "Converting JSON value to record")
                    yield {"value": data}
                
                progress.update(100, "JSON parsing complete")
                
        except Exception as e:
            logger.error(f"Error parsing JSON file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write data to JSON file"""
        try:
            progress.update(10, "Collecting data for JSON export")
            
            # Collect all data
            records = list(data)
            
            progress.update(50, f"Writing {len(records)} records to JSON")
            
            with open(file_path, 'w', encoding=options.encoding) as f:
                if options.pretty_print:
                    json.dump(records, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(records, f, ensure_ascii=False)
            
            progress.update(100, f"JSON export complete: {len(records)} records")
            
        except Exception as e:
            logger.error(f"Error writing JSON file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate JSON data structure"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check if all items are JSON serializable
        try:
            json.dumps(data)
        except TypeError as e:
            errors.append(f"Data not JSON serializable: {e}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )


class SQLFormatHandler(FormatHandler):
    """Handler for SQL format files"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse SQL file and extract statements"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            progress.update(20, "Parsing SQL statements")
            
            # Split SQL statements (basic implementation)
            statements = self._split_sql_statements(content)
            
            total_statements = len(statements)
            for i, statement in enumerate(statements):
                progress_pct = 20 + int((i / total_statements) * 70)
                progress.update(progress_pct, f"Processing statement {i + 1}/{total_statements}")
                
                yield {
                    "statement": statement.strip(),
                    "statement_type": self._get_statement_type(statement),
                    "line_number": i + 1
                }
            
            progress.update(100, f"SQL parsing complete: {total_statements} statements")
            
        except Exception as e:
            logger.error(f"Error parsing SQL file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write SQL statements to file"""
        try:
            with open(file_path, 'w', encoding=options.encoding) as f:
                statement_count = 0
                
                for record in data:
                    if isinstance(record, dict) and 'statement' in record:
                        f.write(record['statement'])
                        if not record['statement'].rstrip().endswith(';'):
                            f.write(';')
                        f.write('\n\n')
                    else:
                        # Assume it's a raw SQL statement
                        f.write(str(record))
                        if not str(record).rstrip().endswith(';'):
                            f.write(';')
                        f.write('\n\n')
                    
                    statement_count += 1
                    
                    if statement_count % 100 == 0:
                        progress.update(
                            min(90, (statement_count // 100) * 10),
                            f"Written {statement_count} statements"
                        )
                
                progress.update(100, f"SQL export complete: {statement_count} statements")
                
        except Exception as e:
            logger.error(f"Error writing SQL file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate SQL data structure"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        row_errors = {}
        
        for i, record in enumerate(data):
            if isinstance(record, dict):
                if 'statement' not in record:
                    row_errors[i] = ["Missing 'statement' field"]
                elif not record['statement'].strip():
                    row_errors[i] = ["Empty SQL statement"]
            elif not str(record).strip():
                row_errors[i] = ["Empty SQL statement"]
        
        return ValidationResult(
            valid=len(errors) == 0 and len(row_errors) == 0,
            errors=errors,
            warnings=warnings,
            row_errors=row_errors
        )
    
    def _split_sql_statements(self, content: str) -> List[str]:
        """Split SQL content into individual statements"""
        # Basic SQL statement splitting (can be enhanced)
        statements = []
        current_statement = ""
        in_string = False
        string_char = None
        
        i = 0
        while i < len(content):
            char = content[i]
            
            if not in_string:
                if char in ("'", '"'):
                    in_string = True
                    string_char = char
                elif char == ';':
                    if current_statement.strip():
                        statements.append(current_statement.strip())
                    current_statement = ""
                    i += 1
                    continue
            else:
                if char == string_char:
                    # Check for escaped quotes
                    if i + 1 < len(content) and content[i + 1] == string_char:
                        i += 1  # Skip escaped quote
                    else:
                        in_string = False
                        string_char = None
            
            current_statement += char
            i += 1
        
        # Add final statement if exists
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        return statements
    
    def _get_statement_type(self, statement: str) -> str:
        """Determine the type of SQL statement"""
        statement_upper = statement.strip().upper()
        
        if statement_upper.startswith('SELECT'):
            return 'SELECT'
        elif statement_upper.startswith('INSERT'):
            return 'INSERT'
        elif statement_upper.startswith('UPDATE'):
            return 'UPDATE'
        elif statement_upper.startswith('DELETE'):
            return 'DELETE'
        elif statement_upper.startswith('CREATE'):
            return 'CREATE'
        elif statement_upper.startswith('DROP'):
            return 'DROP'
        elif statement_upper.startswith('ALTER'):
            return 'ALTER'
        else:
            return 'OTHER'


class XMLFormatHandler(FormatHandler):
    """Handler for XML format files"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse XML file and yield records"""
        try:
            progress.update(10, "Loading XML file")
            tree = ET.parse(file_path)
            root = tree.getroot()
            
            progress.update(30, "Processing XML elements")
            
            # Check if root has children that look like records (same tag names)
            if len(root) > 1:
                # Check if children have the same tag (indicating multiple records)
                child_tags = [child.tag for child in root]
                if len(set(child_tags)) == 1:  # All children have same tag
                    # Multiple records with same structure
                    total_elements = len(root)
                    for i, element in enumerate(root):
                        progress_pct = 30 + int((i / total_elements) * 60)
                        progress.update(progress_pct, f"Processing element {i + 1}/{total_elements}")
                        
                        yield self._element_to_dict(element)
                else:
                    # Mixed child tags - treat root as single record
                    progress.update(90, "Processing single XML element")
                    yield self._element_to_dict(root)
            else:
                # Single root element or root with single child
                progress.update(90, "Processing single XML element")
                yield self._element_to_dict(root)
            
            progress.update(100, "XML parsing complete")
            
        except Exception as e:
            logger.error(f"Error parsing XML file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write data to XML file"""
        try:
            progress.update(10, "Creating XML structure")
            
            root = ET.Element("data")
            
            record_count = 0
            for record in data:
                record_element = ET.SubElement(root, "record")
                self._dict_to_element(record, record_element)
                record_count += 1
                
                if record_count % 1000 == 0:
                    progress.update(
                        min(80, (record_count // 1000) * 10),
                        f"Processed {record_count} records"
                    )
            
            progress.update(90, f"Writing XML file with {record_count} records")
            
            tree = ET.ElementTree(root)
            if options.pretty_print:
                self._indent_xml(root)
            
            tree.write(file_path, encoding=options.encoding, xml_declaration=True)
            
            progress.update(100, f"XML export complete: {record_count} records")
            
        except Exception as e:
            logger.error(f"Error writing XML file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate XML data structure"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check if data can be converted to XML
        for i, record in enumerate(data):
            if not isinstance(record, dict):
                errors.append(f"Record {i} is not a dictionary")
                continue
            
            # Check for XML-invalid characters in keys
            for key in record.keys():
                if not isinstance(key, str) or not key.replace('_', '').replace('-', '').isalnum():
                    warnings.append(f"Record {i} has potentially invalid XML key: {key}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _element_to_dict(self, element: ET.Element) -> Dict[str, Any]:
        """Convert XML element to dictionary"""
        result = {}
        
        # Add attributes
        if element.attrib:
            result.update(element.attrib)
        
        # Add text content
        if element.text and element.text.strip():
            if len(element) == 0:  # No child elements
                return element.text.strip()
            else:
                result['_text'] = element.text.strip()
        
        # Add child elements
        for child in element:
            child_data = self._element_to_dict(child)
            
            if child.tag in result:
                # Multiple elements with same tag - convert to list
                if not isinstance(result[child.tag], list):
                    result[child.tag] = [result[child.tag]]
                result[child.tag].append(child_data)
            else:
                result[child.tag] = child_data
        
        return result if result else (element.text.strip() if element.text else "")
    
    def _dict_to_element(self, data: Dict[str, Any], parent: ET.Element) -> None:
        """Convert dictionary to XML elements"""
        for key, value in data.items():
            if key.startswith('_'):
                continue  # Skip special keys
            
            if isinstance(value, dict):
                child = ET.SubElement(parent, str(key))
                self._dict_to_element(value, child)
            elif isinstance(value, list):
                for item in value:
                    child = ET.SubElement(parent, str(key))
                    if isinstance(item, dict):
                        self._dict_to_element(item, child)
                    else:
                        child.text = str(item)
            else:
                child = ET.SubElement(parent, str(key))
                child.text = str(value) if value is not None else ""
    
    def _indent_xml(self, elem: ET.Element, level: int = 0) -> None:
        """Add pretty-printing indentation to XML"""
        indent = "\n" + level * "  "
        if len(elem):
            if not elem.text or not elem.text.strip():
                elem.text = indent + "  "
            if not elem.tail or not elem.tail.strip():
                elem.tail = indent
            for child in elem:
                self._indent_xml(child, level + 1)
            if not child.tail or not child.tail.strip():
                child.tail = indent
        else:
            if level and (not elem.tail or not elem.tail.strip()):
                elem.tail = indent


class FormatHandlerFactory:
    """Factory for creating format-specific handlers"""
    
    _handlers = {
        FileFormat.CSV: CSVFormatHandler,
        FileFormat.JSON: JSONFormatHandler,
        FileFormat.SQL: SQLFormatHandler,
        FileFormat.XML: XMLFormatHandler,
    }
    
    @classmethod
    def create_handler(cls, format_type: FileFormat) -> FormatHandler:
        """Create handler for specified format"""
        handler_class = cls._handlers.get(format_type)
        if not handler_class:
            raise ValueError(f"No handler available for format: {format_type}")
        
        return handler_class()
    
    @classmethod
    def register_handler(cls, format_type: FileFormat, handler_class: type) -> None:
        """Register a new format handler"""
        cls._handlers[format_type] = handler_class
    
    @classmethod
    def get_supported_formats(cls) -> List[FileFormat]:
        """Get list of supported formats"""
        return list(cls._handlers.keys())

class PostgreSQLDumpHandler(FormatHandler):
    """Handler for PostgreSQL dump files (.sql, .dump, .tar, .custom)"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse PostgreSQL dump file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.sql':
                # Plain SQL dump
                return self._parse_sql_dump(file_path, progress)
            elif file_ext in ['.dump', '.custom']:
                # Custom format dump - requires pg_restore
                return self._parse_custom_dump(file_path, progress)
            elif file_ext == '.tar':
                # Tar format dump
                return self._parse_tar_dump(file_path, progress)
            else:
                raise ValueError(f"Unsupported PostgreSQL dump format: {file_ext}")
                
        except Exception as e:
            logger.error(f"Error parsing PostgreSQL dump: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write PostgreSQL dump file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.sql':
                self._write_sql_dump(file_path, data, options, progress)
            else:
                raise ValueError(f"Writing {file_ext} format not supported directly. Use pg_dump.")
                
        except Exception as e:
            logger.error(f"Error writing PostgreSQL dump: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate PostgreSQL dump data"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check for PostgreSQL-specific statements
        pg_keywords = ['CREATE TABLE', 'CREATE INDEX', 'CREATE SEQUENCE', 'COPY', 'INSERT INTO']
        has_pg_content = False
        
        for i, record in enumerate(data):
            if isinstance(record, dict) and 'statement' in record:
                statement = record['statement'].upper()
                if any(keyword in statement for keyword in pg_keywords):
                    has_pg_content = True
                    break
        
        if not has_pg_content:
            warnings.append("No PostgreSQL-specific content detected")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _parse_sql_dump(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse plain SQL dump file"""
        sql_handler = SQLFormatHandler()
        return sql_handler.parse_file(file_path, progress)
    
    def _parse_custom_dump(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse custom format dump using pg_restore"""
        import subprocess
        import tempfile
        
        try:
            # Create temporary SQL file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as temp_file:
                temp_sql_path = temp_file.name
            
            progress.update(20, "Converting custom dump to SQL")
            
            # Use pg_restore to convert to SQL
            result = subprocess.run([
                'pg_restore', '--no-owner', '--no-privileges', '--schema-only',
                '--file', temp_sql_path, file_path
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                raise Exception(f"pg_restore failed: {result.stderr}")
            
            progress.update(50, "Parsing converted SQL")
            
            # Parse the converted SQL file
            sql_handler = SQLFormatHandler()
            yield from sql_handler.parse_file(temp_sql_path, progress)
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_sql_path)
            except:
                pass
    
    def _parse_tar_dump(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse tar format dump"""
        import tarfile
        import tempfile
        
        try:
            progress.update(10, "Extracting tar dump")
            
            with tarfile.open(file_path, 'r') as tar:
                # Extract to temporary directory
                with tempfile.TemporaryDirectory() as temp_dir:
                    tar.extractall(temp_dir)
                    
                    progress.update(30, "Processing extracted files")
                    
                    # Look for toc.dat and data files
                    toc_path = os.path.join(temp_dir, 'toc.dat')
                    if os.path.exists(toc_path):
                        # Process table of contents
                        yield from self._parse_toc_file(toc_path, temp_dir, progress)
                    else:
                        # Fallback: process all .dat files
                        for file_name in os.listdir(temp_dir):
                            if file_name.endswith('.dat'):
                                file_path = os.path.join(temp_dir, file_name)
                                yield {
                                    "file": file_name,
                                    "type": "data_file",
                                    "path": file_path
                                }
                    
                    progress.update(100, "Tar dump processing complete")
                    
        except Exception as e:
            logger.error(f"Error parsing tar dump: {e}")
            raise
    
    def _parse_toc_file(self, toc_path: str, extract_dir: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse PostgreSQL tar dump table of contents"""
        try:
            with open(toc_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # Basic TOC parsing (simplified)
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if line.strip():
                    progress.update(
                        30 + int((i / len(lines)) * 60),
                        f"Processing TOC entry {i + 1}/{len(lines)}"
                    )
                    
                    yield {
                        "toc_entry": line.strip(),
                        "line_number": i + 1,
                        "type": "toc_entry"
                    }
                    
        except Exception as e:
            logger.warning(f"Error parsing TOC file: {e}")
    
    def _write_sql_dump(self, file_path: str, data: Iterator[Dict[str, Any]], 
                       options: ExportOptions, progress: ProgressTracker) -> None:
        """Write SQL dump file"""
        sql_handler = SQLFormatHandler()
        sql_handler.write_file(file_path, data, options, progress)


class MySQLDumpHandler(FormatHandler):
    """Handler for MySQL dump files (.sql, .dump)"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse MySQL dump file"""
        try:
            progress.update(10, "Reading MySQL dump file")
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            progress.update(30, "Parsing MySQL statements")
            
            # Split into statements, handling MySQL-specific syntax
            statements = self._split_mysql_statements(content)
            
            total_statements = len(statements)
            for i, statement in enumerate(statements):
                progress_pct = 30 + int((i / total_statements) * 60)
                progress.update(progress_pct, f"Processing statement {i + 1}/{total_statements}")
                
                yield {
                    "statement": statement.strip(),
                    "statement_type": self._get_mysql_statement_type(statement),
                    "line_number": i + 1
                }
            
            progress.update(100, f"MySQL dump parsing complete: {total_statements} statements")
            
        except Exception as e:
            logger.error(f"Error parsing MySQL dump: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write MySQL dump file"""
        try:
            with open(file_path, 'w', encoding=options.encoding) as f:
                # Write MySQL dump header
                f.write("-- MySQL dump\n")
                f.write("-- Generated by Multi-Database Manager\n")
                f.write(f"-- Date: {datetime.now().isoformat()}\n\n")
                f.write("SET NAMES utf8mb4;\n")
                f.write("SET FOREIGN_KEY_CHECKS = 0;\n\n")
                
                statement_count = 0
                
                for record in data:
                    if isinstance(record, dict) and 'statement' in record:
                        statement = record['statement']
                        if not statement.rstrip().endswith(';'):
                            statement += ';'
                        f.write(statement + '\n\n')
                    else:
                        # Assume it's a raw SQL statement
                        statement = str(record)
                        if not statement.rstrip().endswith(';'):
                            statement += ';'
                        f.write(statement + '\n\n')
                    
                    statement_count += 1
                    
                    if statement_count % 100 == 0:
                        progress.update(
                            min(90, (statement_count // 100) * 10),
                            f"Written {statement_count} statements"
                        )
                
                # Write MySQL dump footer
                f.write("SET FOREIGN_KEY_CHECKS = 1;\n")
                
                progress.update(100, f"MySQL dump export complete: {statement_count} statements")
                
        except Exception as e:
            logger.error(f"Error writing MySQL dump: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate MySQL dump data"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check for MySQL-specific content
        mysql_keywords = ['CREATE TABLE', 'ENGINE=', 'AUTO_INCREMENT', 'CHARSET=']
        has_mysql_content = False
        
        for record in data:
            if isinstance(record, dict) and 'statement' in record:
                statement = record['statement'].upper()
                if any(keyword in statement for keyword in mysql_keywords):
                    has_mysql_content = True
                    break
        
        if not has_mysql_content:
            warnings.append("No MySQL-specific content detected")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _split_mysql_statements(self, content: str) -> List[str]:
        """Split MySQL dump content into statements"""
        # Handle MySQL-specific syntax like DELIMITER
        statements = []
        current_statement = ""
        delimiter = ";"
        in_string = False
        string_char = None
        
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            
            # Skip comments
            if line.startswith('--') or line.startswith('#'):
                continue
            
            # Handle DELIMITER command
            if line.upper().startswith('DELIMITER'):
                delimiter = line.split()[1] if len(line.split()) > 1 else ";"
                continue
            
            # Process line character by character
            i = 0
            while i < len(line):
                char = line[i]
                
                if not in_string:
                    if char in ("'", '"', '`'):
                        in_string = True
                        string_char = char
                    elif line[i:i+len(delimiter)] == delimiter:
                        if current_statement.strip():
                            statements.append(current_statement.strip())
                        current_statement = ""
                        i += len(delimiter) - 1
                        i += 1
                        continue
                else:
                    if char == string_char:
                        # Check for escaped quotes
                        if i + 1 < len(line) and line[i + 1] == string_char:
                            i += 1  # Skip escaped quote
                        else:
                            in_string = False
                            string_char = None
                
                current_statement += char
                i += 1
            
            current_statement += '\n'
        
        # Add final statement if exists
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        return statements
    
    def _get_mysql_statement_type(self, statement: str) -> str:
        """Determine MySQL statement type"""
        statement_upper = statement.strip().upper()
        
        if statement_upper.startswith('CREATE'):
            if 'TABLE' in statement_upper:
                return 'CREATE_TABLE'
            elif 'INDEX' in statement_upper:
                return 'CREATE_INDEX'
            elif 'DATABASE' in statement_upper:
                return 'CREATE_DATABASE'
            else:
                return 'CREATE'
        elif statement_upper.startswith('INSERT'):
            return 'INSERT'
        elif statement_upper.startswith('LOCK TABLES'):
            return 'LOCK_TABLES'
        elif statement_upper.startswith('UNLOCK TABLES'):
            return 'UNLOCK_TABLES'
        elif statement_upper.startswith('SET'):
            return 'SET'
        else:
            return 'OTHER'


class MongoDBHandler(FormatHandler):
    """Handler for MongoDB import/export (.json, .bson, .archive)"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse MongoDB export file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.json':
                return self._parse_mongodb_json(file_path, progress)
            elif file_ext == '.bson':
                return self._parse_mongodb_bson(file_path, progress)
            elif file_ext == '.archive':
                return self._parse_mongodb_archive(file_path, progress)
            else:
                raise ValueError(f"Unsupported MongoDB format: {file_ext}")
                
        except Exception as e:
            logger.error(f"Error parsing MongoDB file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write MongoDB export file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.json':
                self._write_mongodb_json(file_path, data, options, progress)
            else:
                raise ValueError(f"Writing {file_ext} format requires mongoexport/mongodump")
                
        except Exception as e:
            logger.error(f"Error writing MongoDB file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate MongoDB data"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check for MongoDB-specific fields
        mongodb_fields = ['_id', '$oid', '$date', '$numberLong']
        has_mongodb_content = False
        
        for record in data:
            if isinstance(record, dict):
                record_str = json.dumps(record)
                if any(field in record_str for field in mongodb_fields):
                    has_mongodb_content = True
                    break
        
        if not has_mongodb_content:
            warnings.append("No MongoDB-specific content detected")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _parse_mongodb_json(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse MongoDB JSON export (one document per line)"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                total_size = os.path.getsize(file_path)
                processed_size = 0
                line_num = 0
                
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            document = json.loads(line)
                            yield document
                            
                            line_num += 1
                            if line_num % 1000 == 0:
                                current_pos = f.tell()
                                progress_pct = int((current_pos / total_size) * 100)
                                progress.update(progress_pct, f"Processed {line_num} documents")
                                
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON on line {line_num + 1}: {e}")
                            continue
                
                progress.update(100, f"MongoDB JSON parsing complete: {line_num} documents")
                
        except Exception as e:
            logger.error(f"Error parsing MongoDB JSON: {e}")
            raise
    
    def _parse_mongodb_bson(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse MongoDB BSON file"""
        try:
            import bson
            
            progress.update(10, "Reading BSON file")
            
            with open(file_path, 'rb') as f:
                file_size = os.path.getsize(file_path)
                processed_bytes = 0
                doc_count = 0
                
                while True:
                    try:
                        # Read BSON document
                        document = bson.decode_file_iter(f).__next__()
                        yield document
                        
                        doc_count += 1
                        processed_bytes = f.tell()
                        
                        if doc_count % 1000 == 0:
                            progress_pct = int((processed_bytes / file_size) * 100)
                            progress.update(progress_pct, f"Processed {doc_count} documents")
                            
                    except StopIteration:
                        break
                    except Exception as e:
                        logger.warning(f"Error reading BSON document {doc_count + 1}: {e}")
                        break
                
                progress.update(100, f"BSON parsing complete: {doc_count} documents")
                
        except ImportError:
            raise ImportError("pymongo required for BSON support")
        except Exception as e:
            logger.error(f"Error parsing BSON file: {e}")
            raise
    
    def _parse_mongodb_archive(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse MongoDB archive file"""
        import subprocess
        import tempfile
        
        try:
            progress.update(10, "Extracting MongoDB archive")
            
            # Create temporary directory for extraction
            with tempfile.TemporaryDirectory() as temp_dir:
                # Use mongorestore to extract archive
                result = subprocess.run([
                    'mongorestore', '--archive=' + file_path, '--dir', temp_dir, '--dryRun'
                ], capture_output=True, text=True)
                
                if result.returncode != 0:
                    raise Exception(f"mongorestore failed: {result.stderr}")
                
                progress.update(50, "Processing extracted files")
                
                # Process extracted BSON files
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        if file.endswith('.bson'):
                            bson_path = os.path.join(root, file)
                            yield from self._parse_mongodb_bson(bson_path, progress)
                
                progress.update(100, "Archive processing complete")
                
        except Exception as e:
            logger.error(f"Error parsing MongoDB archive: {e}")
            raise
    
    def _write_mongodb_json(self, file_path: str, data: Iterator[Dict[str, Any]], 
                           options: ExportOptions, progress: ProgressTracker) -> None:
        """Write MongoDB JSON export format"""
        try:
            with open(file_path, 'w', encoding=options.encoding) as f:
                doc_count = 0
                
                for document in data:
                    # Write each document as a single line JSON
                    json_line = json.dumps(document, ensure_ascii=False, separators=(',', ':'))
                    f.write(json_line + '\n')
                    
                    doc_count += 1
                    
                    if doc_count % 1000 == 0:
                        progress.update(
                            min(90, (doc_count // 1000) * 10),
                            f"Written {doc_count} documents"
                        )
                
                progress.update(100, f"MongoDB JSON export complete: {doc_count} documents")
                
        except Exception as e:
            logger.error(f"Error writing MongoDB JSON: {e}")
            raise


class RedisHandler(FormatHandler):
    """Handler for Redis data import/export (.rdb, .aof)"""
    
    def parse_file(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse Redis data file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.rdb':
                return self._parse_redis_rdb(file_path, progress)
            elif file_ext == '.aof':
                return self._parse_redis_aof(file_path, progress)
            else:
                raise ValueError(f"Unsupported Redis format: {file_ext}")
                
        except Exception as e:
            logger.error(f"Error parsing Redis file: {e}")
            raise
    
    def write_file(self, file_path: str, data: Iterator[Dict[str, Any]], 
                   options: ExportOptions, progress: ProgressTracker) -> None:
        """Write Redis data file"""
        try:
            file_ext = Path(file_path).suffix.lower()
            
            if file_ext == '.aof':
                self._write_redis_aof(file_path, data, options, progress)
            else:
                raise ValueError(f"Writing {file_ext} format not supported directly")
                
        except Exception as e:
            logger.error(f"Error writing Redis file: {e}")
            raise
    
    def validate_data(self, data: List[Dict[str, Any]]) -> ValidationResult:
        """Validate Redis data"""
        if not data:
            return ValidationResult(valid=False, errors=["No data to validate"])
        
        errors = []
        warnings = []
        
        # Check for Redis-specific fields
        redis_fields = ['key', 'value', 'type', 'ttl', 'command']
        has_redis_content = False
        
        for record in data:
            if isinstance(record, dict):
                if any(field in record for field in redis_fields):
                    has_redis_content = True
                    break
        
        if not has_redis_content:
            warnings.append("No Redis-specific content detected")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _parse_redis_rdb(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse Redis RDB file"""
        try:
            # Note: This is a simplified parser. Full RDB parsing requires specialized libraries
            progress.update(10, "Reading RDB file")
            
            with open(file_path, 'rb') as f:
                # Read RDB header
                header = f.read(9)  # "REDIS" + version
                if not header.startswith(b'REDIS'):
                    raise ValueError("Invalid RDB file format")
                
                progress.update(30, "Parsing RDB content")
                
                # This is a very basic implementation
                # In practice, you'd use a library like rdbtools
                file_size = os.path.getsize(file_path)
                
                yield {
                    "type": "rdb_header",
                    "version": header[5:9].decode('ascii', errors='ignore'),
                    "file_size": file_size
                }
                
                progress.update(100, "RDB parsing complete (basic)")
                
        except Exception as e:
            logger.error(f"Error parsing RDB file: {e}")
            raise
    
    def _parse_redis_aof(self, file_path: str, progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Parse Redis AOF (Append Only File)"""
        try:
            progress.update(10, "Reading AOF file")
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                total_size = os.path.getsize(file_path)
                command_count = 0
                
                while True:
                    line = f.readline()
                    if not line:
                        break
                    
                    line = line.strip()
                    
                    # AOF format: *<argc>\r\n$<len>\r\n<arg>\r\n...
                    if line.startswith('*'):
                        try:
                            argc = int(line[1:])
                            command_parts = []
                            
                            for i in range(argc):
                                # Read argument length
                                len_line = f.readline().strip()
                                if len_line.startswith('$'):
                                    arg_len = int(len_line[1:])
                                    # Read argument
                                    arg = f.readline().strip()
                                    command_parts.append(arg)
                            
                            if command_parts:
                                yield {
                                    "command": command_parts[0].upper(),
                                    "args": command_parts[1:] if len(command_parts) > 1 else [],
                                    "raw_command": ' '.join(command_parts)
                                }
                                
                                command_count += 1
                                
                                if command_count % 1000 == 0:
                                    current_pos = f.tell()
                                    progress_pct = int((current_pos / total_size) * 100)
                                    progress.update(progress_pct, f"Processed {command_count} commands")
                                    
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Error parsing AOF command: {e}")
                            continue
                
                progress.update(100, f"AOF parsing complete: {command_count} commands")
                
        except Exception as e:
            logger.error(f"Error parsing AOF file: {e}")
            raise
    
    def _write_redis_aof(self, file_path: str, data: Iterator[Dict[str, Any]], 
                        options: ExportOptions, progress: ProgressTracker) -> None:
        """Write Redis AOF format"""
        try:
            with open(file_path, 'w', encoding=options.encoding) as f:
                command_count = 0
                
                for record in data:
                    if isinstance(record, dict):
                        if 'command' in record and 'args' in record:
                            # Write AOF format
                            command = record['command']
                            args = record.get('args', [])
                            all_parts = [command] + args
                            
                            # Write command in AOF format
                            f.write(f"*{len(all_parts)}\r\n")
                            for part in all_parts:
                                part_str = str(part)
                                f.write(f"${len(part_str)}\r\n")
                                f.write(f"{part_str}\r\n")
                            
                        elif 'raw_command' in record:
                            # Write raw command (convert to AOF format)
                            raw_command = record['raw_command']
                            parts = raw_command.split()
                            
                            f.write(f"*{len(parts)}\r\n")
                            for part in parts:
                                f.write(f"${len(part)}\r\n")
                                f.write(f"{part}\r\n")
                    
                    command_count += 1
                    
                    if command_count % 1000 == 0:
                        progress.update(
                            min(90, (command_count // 1000) * 10),
                            f"Written {command_count} commands"
                        )
                
                progress.update(100, f"AOF export complete: {command_count} commands")
                
        except Exception as e:
            logger.error(f"Error writing AOF file: {e}")
            raise


# Update the FormatHandlerFactory to include database-specific handlers
FormatHandlerFactory.register_handler(FileFormat.POSTGRESQL_DUMP, PostgreSQLDumpHandler)
FormatHandlerFactory.register_handler(FileFormat.MYSQL_DUMP, MySQLDumpHandler)
FormatHandlerFactory.register_handler(FileFormat.MONGODB_JSON, MongoDBHandler)
FormatHandlerFactory.register_handler(FileFormat.MONGODB_BSON, MongoDBHandler)
FormatHandlerFactory.register_handler(FileFormat.REDIS_RDB, RedisHandler)
FormatHandlerFactory.register_handler(FileFormat.REDIS_AOF, RedisHandler)


class ImportExportError(Exception):
    """Base exception for import/export operations"""
    pass


class FormatDetectionError(ImportExportError):
    """Error in format detection"""
    pass


class ValidationError(ImportExportError):
    """Error in data validation"""
    pass


class TransformationError(ImportExportError):
    """Error in data transformation"""
    pass


class ProgressError(ImportExportError):
    """Error in progress tracking"""
    pass


@dataclass
class TransformationRule:
    """Data transformation rule"""
    source_field: str
    target_field: str
    transformation_type: str  # 'rename', 'convert', 'map', 'calculate'
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ErrorRecoveryStrategy:
    """Error recovery strategy configuration"""
    strategy_type: str  # 'skip', 'retry', 'default_value', 'stop'
    max_retries: int = 3
    default_value: Any = None
    retry_delay: float = 1.0


class DataTransformer:
    """Handles data transformation operations"""
    
    def __init__(self):
        self.transformers = {
            'rename': self._rename_field,
            'convert': self._convert_type,
            'map': self._map_values,
            'calculate': self._calculate_field,
            'filter': self._filter_records,
            'validate': self._validate_field
        }
    
    def apply_transformations(self, data: Iterator[Dict[str, Any]], 
                            rules: List[TransformationRule],
                            progress: ProgressTracker) -> Iterator[Dict[str, Any]]:
        """Apply transformation rules to data"""
        try:
            progress.update(0, "Starting data transformation")
            
            processed_count = 0
            for record in data:
                try:
                    transformed_record = self._apply_record_transformations(record, rules)
                    if transformed_record is not None:  # Record wasn't filtered out
                        yield transformed_record
                    
                    processed_count += 1
                    if processed_count % 1000 == 0:
                        progress.update(
                            min(90, (processed_count // 1000) * 10),
                            f"Transformed {processed_count} records"
                        )
                        
                except Exception as e:
                    logger.warning(f"Error transforming record {processed_count}: {e}")
                    # Continue with next record
                    continue
            
            progress.update(100, f"Transformation complete: {processed_count} records")
            
        except Exception as e:
            raise TransformationError(f"Data transformation failed: {e}")
    
    def _apply_record_transformations(self, record: Dict[str, Any], 
                                    rules: List[TransformationRule]) -> Optional[Dict[str, Any]]:
        """Apply transformation rules to a single record"""
        result = record.copy()
        
        for rule in rules:
            transformer = self.transformers.get(rule.transformation_type)
            if not transformer:
                logger.warning(f"Unknown transformation type: {rule.transformation_type}")
                continue
            
            try:
                result = transformer(result, rule)
                if result is None:  # Record was filtered out
                    return None
            except Exception as e:
                logger.warning(f"Transformation rule failed: {rule.transformation_type} - {e}")
                continue
        
        return result
    
    def _rename_field(self, record: Dict[str, Any], rule: TransformationRule) -> Dict[str, Any]:
        """Rename a field"""
        if rule.source_field in record:
            record[rule.target_field] = record.pop(rule.source_field)
        return record
    
    def _convert_type(self, record: Dict[str, Any], rule: TransformationRule) -> Dict[str, Any]:
        """Convert field type"""
        if rule.source_field in record:
            value = record[rule.source_field]
            target_type = rule.parameters.get('target_type', 'str')
            
            try:
                if target_type == 'int':
                    record[rule.target_field] = int(value) if value is not None else None
                elif target_type == 'float':
                    record[rule.target_field] = float(value) if value is not None else None
                elif target_type == 'str':
                    record[rule.target_field] = str(value) if value is not None else None
                elif target_type == 'bool':
                    record[rule.target_field] = bool(value) if value is not None else None
                elif target_type == 'datetime':
                    from datetime import datetime
                    if isinstance(value, str):
                        format_str = rule.parameters.get('format', '%Y-%m-%d %H:%M:%S')
                        record[rule.target_field] = datetime.strptime(value, format_str)
                    else:
                        record[rule.target_field] = value
                else:
                    logger.warning(f"Unknown target type: {target_type}")
                    record[rule.target_field] = value
                    
            except (ValueError, TypeError) as e:
                logger.warning(f"Type conversion failed for {rule.source_field}: {e}")
                # Keep original value on conversion failure
                record[rule.target_field] = value
        
        return record
    
    def _map_values(self, record: Dict[str, Any], rule: TransformationRule) -> Dict[str, Any]:
        """Map field values using a mapping dictionary"""
        if rule.source_field in record:
            value = record[rule.source_field]
            mapping = rule.parameters.get('mapping', {})
            default_value = rule.parameters.get('default', value)
            
            record[rule.target_field] = mapping.get(value, default_value)
        
        return record
    
    def _calculate_field(self, record: Dict[str, Any], rule: TransformationRule) -> Dict[str, Any]:
        """Calculate field value using an expression"""
        try:
            expression = rule.parameters.get('expression', '')
            if expression:
                # Simple expression evaluation (can be enhanced with safer evaluation)
                # For now, support basic arithmetic with field references
                result = self._evaluate_expression(expression, record)
                record[rule.target_field] = result
        except Exception as e:
            logger.warning(f"Expression evaluation failed: {e}")
        
        return record
    
    def _filter_records(self, record: Dict[str, Any], rule: TransformationRule) -> Optional[Dict[str, Any]]:
        """Filter records based on conditions"""
        try:
            condition = rule.parameters.get('condition', '')
            if condition:
                # Simple condition evaluation
                if self._evaluate_condition(condition, record):
                    return record
                else:
                    return None  # Filter out this record
        except Exception as e:
            logger.warning(f"Filter condition evaluation failed: {e}")
        
        return record
    
    def _validate_field(self, record: Dict[str, Any], rule: TransformationRule) -> Dict[str, Any]:
        """Validate field values"""
        if rule.source_field in record:
            value = record[rule.source_field]
            validation_rules = rule.parameters.get('rules', [])
            
            for validation_rule in validation_rules:
                if not self._validate_value(value, validation_rule):
                    logger.warning(f"Validation failed for {rule.source_field}: {validation_rule}")
                    # Could set a default value or mark as invalid
                    break
        
        return record
    
    def _evaluate_expression(self, expression: str, record: Dict[str, Any]) -> Any:
        """Evaluate simple arithmetic expressions with field references"""
        # This is a simplified implementation - in production, use a safer expression evaluator
        import re
        
        # Replace field references with values
        def replace_field(match):
            field_name = match.group(1)
            return str(record.get(field_name, 0))
        
        # Replace {field_name} with actual values
        safe_expression = re.sub(r'\{(\w+)\}', replace_field, expression)
        
        # Only allow basic arithmetic operations
        allowed_chars = set('0123456789+-*/.() ')
        if all(c in allowed_chars for c in safe_expression):
            try:
                return eval(safe_expression)
            except:
                return None
        
        return None
    
    def _evaluate_condition(self, condition: str, record: Dict[str, Any]) -> bool:
        """Evaluate simple conditions"""
        # Simplified condition evaluation - can be enhanced
        import re
        
        # Replace field references
        def replace_field(match):
            field_name = match.group(1)
            value = record.get(field_name)
            if isinstance(value, str):
                return f"'{value}'"
            return str(value) if value is not None else 'None'
        
        safe_condition = re.sub(r'\{(\w+)\}', replace_field, condition)
        
        # Only allow safe comparison operations
        allowed_patterns = [
            r"'[^']*'\s*[=!<>]+\s*'[^']*'",
            r"\d+\.?\d*\s*[=!<>]+\s*\d+\.?\d*",
            r"None\s*[=!]+\s*None"
        ]
        
        if any(re.match(pattern, safe_condition.strip()) for pattern in allowed_patterns):
            try:
                return eval(safe_condition)
            except:
                return True
        
        return True
    
    def _validate_value(self, value: Any, validation_rule: Dict[str, Any]) -> bool:
        """Validate a single value against a rule"""
        rule_type = validation_rule.get('type', 'required')
        
        if rule_type == 'required':
            return value is not None and value != ''
        elif rule_type == 'min_length':
            min_len = validation_rule.get('value', 0)
            return len(str(value)) >= min_len if value is not None else False
        elif rule_type == 'max_length':
            max_len = validation_rule.get('value', float('inf'))
            return len(str(value)) <= max_len if value is not None else True
        elif rule_type == 'pattern':
            import re
            pattern = validation_rule.get('value', '')
            return re.match(pattern, str(value)) is not None if value is not None else False
        elif rule_type == 'range':
            min_val = validation_rule.get('min', float('-inf'))
            max_val = validation_rule.get('max', float('inf'))
            try:
                num_value = float(value)
                return min_val <= num_value <= max_val
            except (ValueError, TypeError):
                return False
        
        return True


class ErrorRecoveryManager:
    """Manages error recovery strategies"""
    
    def __init__(self):
        self.strategies = {}
        self.error_counts = {}
    
    def register_strategy(self, error_type: str, strategy: ErrorRecoveryStrategy):
        """Register error recovery strategy"""
        self.strategies[error_type] = strategy
        self.error_counts[error_type] = 0
    
    def handle_error(self, error: Exception, context: Dict[str, Any]) -> Any:
        """Handle error using registered strategy"""
        error_type = type(error).__name__
        strategy = self.strategies.get(error_type)
        
        if not strategy:
            # Default strategy: log and re-raise
            logger.error(f"Unhandled error: {error}")
            raise error
        
        self.error_counts[error_type] += 1
        
        if strategy.strategy_type == 'skip':
            logger.warning(f"Skipping due to error: {error}")
            return None
        
        elif strategy.strategy_type == 'retry':
            retry_count = context.get('retry_count', 0)
            if retry_count < strategy.max_retries:
                logger.info(f"Retrying operation (attempt {retry_count + 1})")
                import time
                time.sleep(strategy.retry_delay)
                context['retry_count'] = retry_count + 1
                return 'retry'
            else:
                logger.error(f"Max retries exceeded for error: {error}")
                raise error
        
        elif strategy.strategy_type == 'default_value':
            logger.warning(f"Using default value due to error: {error}")
            return strategy.default_value
        
        elif strategy.strategy_type == 'stop':
            logger.error(f"Stopping due to error: {error}")
            raise error
        
        else:
            logger.error(f"Unknown recovery strategy: {strategy.strategy_type}")
            raise error
    
    def get_error_summary(self) -> Dict[str, int]:
        """Get summary of errors encountered"""
        return self.error_counts.copy()


class ImportExportEngine:
    """Main import/export engine with comprehensive error handling and progress tracking"""
    
    def __init__(self):
        self.format_detector = FormatDetector()
        self.data_transformer = DataTransformer()
        self.error_recovery = ErrorRecoveryManager()
        self._setup_default_error_strategies()
    
    def _setup_default_error_strategies(self):
        """Set up default error recovery strategies"""
        self.error_recovery.register_strategy(
            'ValidationError',
            ErrorRecoveryStrategy(strategy_type='skip')
        )
        self.error_recovery.register_strategy(
            'TransformationError',
            ErrorRecoveryStrategy(strategy_type='default_value', default_value={})
        )
        self.error_recovery.register_strategy(
            'OSError',
            ErrorRecoveryStrategy(strategy_type='retry', max_retries=3, retry_delay=1.0)
        )
    
    def import_data(self, file_path: str, target_adapter, options: ImportOptions) -> ImportResult:
        """Import data from file with comprehensive error handling"""
        start_time = datetime.now()
        progress = ProgressTracker(options.progress_callback)
        
        try:
            progress.update(0, "Starting import operation")
            
            # Detect file format
            progress.update(5, "Detecting file format")
            try:
                file_format = self.format_detector.detect_format(file_path)
                if file_format == FileFormat.UNKNOWN:
                    raise FormatDetectionError(f"Unable to detect format for file: {file_path}")
            except Exception as e:
                return ImportResult(
                    success=False,
                    errors=[f"Format detection failed: {e}"]
                )
            
            # Create format handler
            progress.update(10, f"Creating handler for {file_format.value} format")
            try:
                handler = FormatHandlerFactory.create_handler(file_format)
            except Exception as e:
                return ImportResult(
                    success=False,
                    errors=[f"Handler creation failed: {e}"]
                )
            
            # Parse file
            progress.update(15, "Parsing file")
            try:
                data_iterator = handler.parse_file(file_path, progress)
            except Exception as e:
                return ImportResult(
                    success=False,
                    errors=[f"File parsing failed: {e}"]
                )
            
            # Apply transformations if specified
            if options.transformations:
                progress.update(30, "Applying data transformations")
                try:
                    transformation_rules = [
                        TransformationRule(**rule) for rule in options.transformations
                    ]
                    data_iterator = self.data_transformer.apply_transformations(
                        data_iterator, transformation_rules, progress
                    )
                except Exception as e:
                    return ImportResult(
                        success=False,
                        errors=[f"Data transformation failed: {e}"]
                    )
            
            # Import to target database
            progress.update(50, "Importing to database")
            records_processed = 0
            records_imported = 0
            records_failed = 0
            errors = []
            warnings = []
            
            try:
                batch = []
                for record in data_iterator:
                    batch.append(record)
                    records_processed += 1
                    
                    # Process in batches
                    if len(batch) >= options.batch_size:
                        batch_result = self._import_batch(
                            target_adapter, batch, options, progress
                        )
                        records_imported += batch_result['imported']
                        records_failed += batch_result['failed']
                        errors.extend(batch_result['errors'])
                        warnings.extend(batch_result['warnings'])
                        batch = []
                        
                        # Update progress
                        progress.update(
                            50 + min(40, (records_processed // 1000) * 5),
                            f"Imported {records_imported} records"
                        )
                
                # Process remaining records
                if batch:
                    batch_result = self._import_batch(
                        target_adapter, batch, options, progress
                    )
                    records_imported += batch_result['imported']
                    records_failed += batch_result['failed']
                    errors.extend(batch_result['errors'])
                    warnings.extend(batch_result['warnings'])
                
            except Exception as e:
                errors.append(f"Import operation failed: {e}")
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            
            progress.update(100, f"Import complete: {records_imported} imported, {records_failed} failed")
            
            return ImportResult(
                success=len(errors) == 0 or options.ignore_errors,
                records_processed=records_processed,
                records_imported=records_imported,
                records_failed=records_failed,
                errors=errors,
                warnings=warnings,
                execution_time=execution_time,
                metadata={
                    'file_format': file_format.value,
                    'file_path': file_path,
                    'error_summary': self.error_recovery.get_error_summary()
                }
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            return ImportResult(
                success=False,
                errors=[f"Import operation failed: {e}"],
                execution_time=execution_time
            )
    
    def export_data(self, query_result, file_path: str, options: ExportOptions) -> ExportResult:
        """Export data to file with comprehensive error handling"""
        start_time = datetime.now()
        progress = ProgressTracker(options.progress_callback)
        
        try:
            progress.update(0, "Starting export operation")
            
            # Create format handler
            progress.update(10, f"Creating handler for {options.format.value} format")
            try:
                handler = FormatHandlerFactory.create_handler(options.format)
            except Exception as e:
                return ExportResult(
                    success=False,
                    errors=[f"Handler creation failed: {e}"]
                )
            
            # Write data to file
            progress.update(20, "Writing data to file")
            records_exported = 0
            errors = []
            warnings = []
            
            try:
                # Convert query result to iterator if needed
                if hasattr(query_result, '__iter__'):
                    data_iterator = iter(query_result)
                else:
                    data_iterator = iter([query_result])
                
                handler.write_file(file_path, data_iterator, options, progress)
                
                # Count exported records (approximate)
                if hasattr(query_result, '__len__'):
                    records_exported = len(query_result)
                else:
                    records_exported = sum(1 for _ in query_result)
                
            except Exception as e:
                errors.append(f"Export operation failed: {e}")
            
            # Get file size
            file_size = 0
            try:
                file_size = os.path.getsize(file_path)
            except:
                pass
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            
            progress.update(100, f"Export complete: {records_exported} records")
            
            return ExportResult(
                success=len(errors) == 0,
                records_exported=records_exported,
                file_size=file_size,
                errors=errors,
                warnings=warnings,
                execution_time=execution_time,
                output_file=file_path
            )
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            return ExportResult(
                success=False,
                errors=[f"Export operation failed: {e}"],
                execution_time=execution_time
            )
    
    def _import_batch(self, target_adapter, batch: List[Dict[str, Any]], 
                     options: ImportOptions, progress: ProgressTracker) -> Dict[str, Any]:
        """Import a batch of records with error handling"""
        imported = 0
        failed = 0
        errors = []
        warnings = []
        
        for record in batch:
            try:
                # Attempt to import record
                # This would call the target adapter's import method
                # For now, we'll simulate the import
                if hasattr(target_adapter, 'import_record'):
                    result = target_adapter.import_record(record)
                    if result.get('success', True):
                        imported += 1
                    else:
                        failed += 1
                        errors.append(result.get('error', 'Unknown import error'))
                else:
                    # Fallback: assume successful import
                    imported += 1
                    
            except Exception as e:
                failed += 1
                if options.ignore_errors:
                    warnings.append(f"Record import failed: {e}")
                else:
                    errors.append(f"Record import failed: {e}")
        
        return {
            'imported': imported,
            'failed': failed,
            'errors': errors,
            'warnings': warnings
        }