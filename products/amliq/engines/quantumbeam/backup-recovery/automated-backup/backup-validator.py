#!/usr/bin/env python3
"""
QuantumBeam Backup Validator
Comprehensive backup validation and integrity checking system
"""

import asyncio
import json
import logging
import os
import tempfile
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import yaml
import boto3
from botocore.exceptions import ClientError
import psycopg2
import redis
import subprocess
import shutil
import hashlib
import tarfile
import gzip
from pathlib import Path
import requests
from cryptography.fernet import Fernet

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ValidationStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    WARNING = "warning"


class ValidationType(Enum):
    FILE_INTEGRITY = "file_integrity"
    CHECKSUM_VERIFICATION = "checksum_verification"
    ACCESSIBILITY_TEST = "accessibility_test"
    DATABASE_RESTORE_TEST = "database_restore_test"
    FILE_EXTRACTION_TEST = "file_extraction_test"
    SIZE_VERIFICATION = "size_verification"
    ENCRYPTION_VERIFICATION = "encryption_verification"


@dataclass
class ValidationTest:
    """Individual validation test configuration"""
    name: str
    validation_type: ValidationType
    enabled: bool
    critical: bool  # If True, backup fails if this test fails
    timeout_seconds: int
    parameters: Dict[str, Any]


@dataclass
class ValidationResult:
    """Result of a validation test"""
    test_name: str
    status: ValidationStatus
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    details: Dict[str, Any]
    error_message: Optional[str] = None
    warnings: List[str] = None


@dataclass
class BackupValidationReport:
    """Complete validation report for a backup"""
    backup_id: str
    backup_name: str
    backup_path: str
    validation_timestamp: datetime
    overall_status: ValidationStatus
    total_tests: int
    passed_tests: int
    failed_tests: int
    skipped_tests: int
    warning_tests: int
    test_results: List[ValidationResult]
    summary: Dict[str, Any]
    recommendations: List[str]


class FileIntegrityValidator:
    """Validates file integrity and accessibility"""

    def __init__(self):
        pass

    async def validate_file_integrity(self, backup_path: str) -> Dict[str, Any]:
        """Validate basic file integrity"""
        result = {
            'file_exists': False,
            'file_readable': False,
            'file_size_valid': False,
            'file_not_corrupted': False,
            'details': {}
        }

        try:
            # Check if file exists
            if not os.path.exists(backup_path):
                return {
                    **result,
                    'error': 'Backup file does not exist'
                }

            result['file_exists'] = True
            stat = os.stat(backup_path)
            result['details']['file_size'] = stat.st_size
            result['details']['modified_time'] = datetime.fromtimestamp(stat.st_mtime).isoformat()

            # Check file is readable
            try:
                with open(backup_path, 'rb') as f:
                    # Try to read first few bytes
                    f.read(1024)
                result['file_readable'] = True
            except Exception as e:
                result['details']['read_error'] = str(e)

            # Check file size is reasonable (> 0 bytes)
            if stat.st_size > 0:
                result['file_size_valid'] = True
            else:
                result['details']['size_error'] = 'File is empty'

            # Check file header based on type
            file_extension = Path(backup_path).suffix.lower()
            header_valid = await self._validate_file_header(backup_path, file_extension)
            result['file_not_corrupted'] = header_valid['valid']
            result['details']['header_info'] = header_valid

        except Exception as e:
            result['error'] = str(e)

        return result

    async def _validate_file_header(self, file_path: str, extension: str) -> Dict[str, Any]:
        """Validate file header/magic bytes"""
        try:
            with open(file_path, 'rb') as f:
                header = f.read(16)  # Read first 16 bytes

            # Known magic bytes
            magic_signatures = {
                '.gz': b'\x1f\x8b',
                '.tar': b'',  # tar doesn't have magic bytes
                '.zip': b'PK\x03\x04',
                '.dump': b'PGDMP',  # PostgreSQL custom format
                '.sql': b'--',  # SQL dump
                '.enc': b''  # Encrypted files - no visible header
            }

            if extension in ['.gz', '.zip', '.dump', '.sql']:
                expected_magic = magic_signatures.get(extension, b'')
                if expected_magic and not header.startswith(expected_magic):
                    return {
                        'valid': False,
                        'error': f'Invalid file header for {extension} file',
                        'expected': expected_magic.hex(),
                        'found': header[:len(expected_magic)].hex()
                    }
                else:
                    return {
                        'valid': True,
                        'file_type': extension,
                        'header': header.hex()
                    }
            else:
                # For unknown or encrypted files, just check that we can read
                return {
                    'valid': True,
                    'file_type': 'unknown',
                    'header': header.hex()
                }

        except Exception as e:
            return {
                'valid': False,
                'error': str(e)
            }


class ChecksumValidator:
    """Validates backup checksums and digests"""

    def __init__(self):
        self.algorithms = {
            'md5': hashlib.md5,
            'sha1': hashlib.sha1,
            'sha256': hashlib.sha256,
            'sha512': hashlib.sha512
        }

    async def calculate_checksum(self, file_path: str, algorithm: str = 'sha256') -> Dict[str, Any]:
        """Calculate checksum for a file"""
        if algorithm not in self.algorithms:
            return {
                'success': False,
                'error': f'Unsupported algorithm: {algorithm}'
            }

        hash_func = self.algorithms[algorithm]()
        file_size = 0

        try:
            start_time = time.time()

            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hash_func.update(chunk)
                    file_size += len(chunk)

            end_time = time.time()
            duration = end_time - start_time

            checksum = hash_func.hexdigest()

            return {
                'success': True,
                'algorithm': algorithm,
                'checksum': checksum,
                'file_size': file_size,
                'duration_seconds': duration,
                'calculated_at': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def verify_checksum(self, file_path: str, expected_checksum: str,
                            algorithm: str = 'sha256') -> Dict[str, Any]:
        """Verify file checksum against expected value"""
        calculation_result = await self.calculate_checksum(file_path, algorithm)

        if not calculation_result['success']:
            return calculation_result

        actual_checksum = calculation_result['checksum']
        is_valid = actual_checksum.lower() == expected_checksum.lower()

        return {
            'valid': is_valid,
            'expected_checksum': expected_checksum,
            'actual_checksum': actual_checksum,
            'algorithm': algorithm,
            'file_size': calculation_result['file_size'],
            'calculation_duration': calculation_result['duration_seconds'],
            'verified_at': datetime.now().isoformat()
        }


class AccessibilityValidator:
    """Validates backup accessibility from storage"""

    def __init__(self, storage_config: Dict[str, Any]):
        self.storage_config = storage_config
        self.s3_client = None

    def get_s3_client(self):
        """Get S3 client"""
        if not self.s3_client:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.storage_config.get('aws_access_key_id'),
                aws_secret_access_key=self.storage_config.get('aws_secret_access_key'),
                region_name=self.storage_config.get('region', 'us-east-1')
            )
        return self.s3_client

    async def test_s3_accessibility(self, bucket_name: str, key: str) -> Dict[str, Any]:
        """Test S3 object accessibility"""
        try:
            s3 = self.get_s3_client()

            # Test object existence
            try:
                s3.head_object(Bucket=bucket_name, Key=key)
                exists = True
            except ClientError as e:
                if e.response['Error']['Code'] == '404':
                    exists = False
                else:
                    raise

            if not exists:
                return {
                    'accessible': False,
                    'exists': False,
                    'error': 'Object does not exist in S3'
                }

            # Test download
            start_time = time.time()
            response = s3.head_object(Bucket=bucket_name, Key=key)
            download_time = time.time() - start_time

            # Generate presigned URL
            presigned_url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': key},
                ExpiresIn=3600
            )

            return {
                'accessible': True,
                'exists': True,
                'size': response['ContentLength'],
                'last_modified': response['LastModified'].isoformat(),
                'etag': response['ETag'].strip('"'),
                'presigned_url': presigned_url,
                'head_request_duration': download_time,
                'tested_at': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'accessible': False,
                'exists': False,
                'error': str(e),
                'tested_at': datetime.now().isoformat()
            }

    async def test_local_accessibility(self, file_path: str) -> Dict[str, Any]:
        """Test local file accessibility"""
        try:
            if not os.path.exists(file_path):
                return {
                    'accessible': False,
                    'exists': False,
                    'error': 'File does not exist locally'
                }

            # Test read access
            start_time = time.time()
            with open(file_path, 'rb') as f:
                # Try to read first 1KB
                f.read(1024)
            read_time = time.time() - start_time

            stat = os.stat(file_path)

            return {
                'accessible': True,
                'exists': True,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'read_test_duration': read_time,
                'tested_at': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'accessible': False,
                'exists': os.path.exists(file_path),
                'error': str(e),
                'tested_at': datetime.now().isoformat()
            }


class DatabaseRestoreValidator:
    """Validates database backup by testing restore process"""

    def __init__(self, db_config: Dict[str, Any]):
        self.db_config = db_config

    async def test_postgresql_restore(self, dump_path: str, test_database: str = None) -> Dict[str, Any]:
        """Test PostgreSQL backup by attempting restore to test database"""
        if not test_database:
            test_database = f"test_restore_{int(time.time())}"

        result = {
            'restore_successful': False,
            'database_created': False,
            'tables_restored': 0,
            'errors': [],
            'details': {}
        }

        original_db = self.db_config['database']
        temp_db_created = False

        try:
            # Connect to PostgreSQL (using postgres database to create test DB)
            admin_config = self.db_config.copy()
            admin_config['database'] = 'postgres'

            conn = psycopg2.connect(**admin_config)
            conn.autocommit = True
            cursor = conn.cursor()

            # Create test database
            try:
                cursor.execute(f"CREATE DATABASE {test_database}")
                temp_db_created = True
                result['database_created'] = True
                logger.info(f"Created test database: {test_database}")
            except Exception as e:
                result['errors'].append(f"Failed to create test database: {e}")
                return result

            cursor.close()
            conn.close()

            # Connect to test database
            test_config = self.db_config.copy()
            test_config['database'] = test_database

            # Test restore using pg_restore
            cmd = [
                'pg_restore',
                '--host', test_config['host'],
                '--port', str(test_config['port']),
                '--username', test_config['username'],
                '--dbname', test_config['database'],
                '--verbose',
                '--no-owner',
                '--no-privileges',
                '--clean',
                '--if-exists',
                dump_path
            ]

            env = os.environ.copy()
            env['PGPASSWORD'] = test_config['password']

            start_time = time.time()
            restore_process = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            restore_time = time.time() - start_time

            if restore_process.returncode == 0:
                result['restore_successful'] = True
                result['details']['restore_duration'] = restore_time
                result['details']['restore_output'] = restore_process.stdout

                # Count restored tables
                try:
                    test_conn = psycopg2.connect(**test_config)
                    test_cursor = test_conn.cursor()
                    test_cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
                    result['tables_restored'] = test_cursor.fetchone()[0]
                    test_cursor.close()
                    test_conn.close()
                except Exception as e:
                    result['errors'].append(f"Failed to count restored tables: {e}")

            else:
                result['errors'].append(f"pg_restore failed: {restore_process.stderr}")
                result['details']['restore_error'] = restore_process.stderr

        except Exception as e:
            result['errors'].append(f"Database restore test failed: {e}")

        finally:
            # Cleanup test database
            if temp_db_created:
                try:
                    admin_config = self.db_config.copy()
                    admin_config['database'] = 'postgres'
                    conn = psycopg2.connect(**admin_config)
                    conn.autocommit = True
                    cursor = conn.cursor()
                    cursor.execute(f"DROP DATABASE IF EXISTS {test_database}")
                    cursor.close()
                    conn.close()
                    logger.info(f"Cleaned up test database: {test_database}")
                except Exception as e:
                    result['errors'].append(f"Failed to cleanup test database: {e}")

        return result


class FileExtractionValidator:
    """Validates backup files by testing extraction"""

    def __init__(self):
        pass

    async def test_tar_extraction(self, tar_path: str) -> Dict[str, Any]:
        """Test tar file extraction"""
        result = {
            'extraction_successful': False,
            'file_count': 0,
            'total_size': 0,
            'errors': [],
            'sample_files': []
        }

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Test tar file listing
                try:
                    with tarfile.open(tar_path, 'r:*') as tar:
                        members = tar.getmembers()
                        result['file_count'] = len(members)

                        total_size = sum(member.size for member in members)
                        result['total_size'] = total_size

                        # Sample extraction (first 10 files, max 1MB total)
                        sample_size = 0
                        for member in members[:10]:
                            if sample_size + member.size > 1024 * 1024:  # 1MB limit
                                break

                            try:
                                tar.extract(member, path=temp_dir)
                                sample_size += member.size
                                result['sample_files'].append(member.name)
                            except Exception as e:
                                result['errors'].append(f"Failed to extract {member.name}: {e}")

                        result['extraction_successful'] = True
                        result['sample_extraction_size'] = sample_size

                except tarfile.TarError as e:
                    result['errors'].append(f"Tar file error: {e}")

        except Exception as e:
            result['errors'].append(f"Extraction test failed: {e}")

        return result

    async def test_gzip_extraction(self, gzip_path: str) -> Dict[str, Any]:
        """Test gzip file extraction"""
        result = {
            'extraction_successful': False,
            'original_size': 0,
            'errors': []
        }

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Test gzip decompression
                try:
                    with gzip.open(gzip_path, 'rb') as gz_file:
                        # Read first 1KB to test decompression
                        data = gz_file.read(1024)
                        result['original_size'] = len(data)  # This is just the sample size

                        result['extraction_successful'] = True
                        result['sample_size'] = len(data)

                except gzip.BadGzipFile as e:
                    result['errors'].append(f"Invalid gzip file: {e}")

        except Exception as e:
            result['errors'].append(f"Gzip extraction test failed: {e}")

        return result


class EncryptionValidator:
    """Validates encrypted backup files"""

    def __init__(self, encryption_key: bytes):
        self.encryption_key = encryption_key

    async def test_encryption_decryption(self, encrypted_path: str) -> Dict[str, Any]:
        """Test encryption/decryption by decrypting a small portion"""
        result = {
            'decryption_successful': False,
            'encryption_valid': False,
            'errors': []
        }

        if not self.encryption_key:
            result['errors'].append("No encryption key provided")
            return result

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                cipher = Fernet(self.encryption_key)

                # Test decryption of first 1KB
                with open(encrypted_path, 'rb') as enc_file:
                    encrypted_data = enc_file.read(1024)  # Read first 1KB

                try:
                    decrypted_data = cipher.decrypt(encrypted_data)
                    result['decryption_successful'] = True
                    result['encryption_valid'] = True
                    result['sample_size'] = len(decrypted_data)

                except Exception as e:
                    result['errors'].append(f"Decryption failed: {e}")

        except Exception as e:
            result['errors'].append(f"Encryption validation failed: {e}")

        return result


class BackupValidator:
    """Main backup validation orchestrator"""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'backup-config.yaml'
        self.config = self._load_config()
        self.validators = self._initialize_validators()

    def _load_config(self) -> Dict[str, Any]:
        """Load validation configuration"""
        try:
            with open(self.config_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config file {self.config_file} not found, using defaults")
            return self._get_default_config()

    def _get_default_config(self) -> Dict[str, Any]:
        """Get default validation configuration"""
        return {
            'validation_tests': [
                {
                    'name': 'File Integrity',
                    'type': 'file_integrity',
                    'enabled': True,
                    'critical': True,
                    'timeout_seconds': 300
                },
                {
                    'name': 'Checksum Verification',
                    'type': 'checksum_verification',
                    'enabled': True,
                    'critical': True,
                    'timeout_seconds': 600
                },
                {
                    'name': 'Accessibility Test',
                    'type': 'accessibility_test',
                    'enabled': True,
                    'critical': True,
                    'timeout_seconds': 300
                },
                {
                    'name': 'Database Restore Test',
                    'type': 'database_restore_test',
                    'enabled': False,  # Expensive, enable manually
                    'critical': False,
                    'timeout_seconds': 1800
                }
            ],
            'checksum_algorithm': 'sha256',
            'test_database_prefix': 'test_restore_',
            'storage_config': {},
            'database_config': {}
        }

    def _initialize_validators(self) -> Dict[str, Any]:
        """Initialize validator instances"""
        return {
            'file_integrity': FileIntegrityValidator(),
            'checksum': ChecksumValidator(),
            'accessibility': AccessibilityValidator(self.config.get('storage_config', {})),
            'database_restore': DatabaseRestoreValidator(self.config.get('database_config', {})),
            'file_extraction': FileExtractionValidator(),
            'encryption': EncryptionValidator(self._get_encryption_key())
        }

    def _get_encryption_key(self) -> Optional[bytes]:
        """Get encryption key from configuration"""
        key_file = self.config.get('encryption', {}).get('key_file')
        if key_file and os.path.exists(key_file):
            try:
                with open(key_file, 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Failed to load encryption key: {e}")
        return None

    async def validate_backup(self, backup_path: str, backup_name: str,
                            expected_checksum: str = None,
                            storage_location: Dict = None) -> BackupValidationReport:
        """Perform comprehensive backup validation"""

        backup_id = f"validation-{int(time.time())}"
        validation_timestamp = datetime.now()

        logger.info(f"Starting validation for backup: {backup_name}")

        test_results = []
        total_tests = 0
        passed_tests = 0
        failed_tests = 0
        skipped_tests = 0
        warning_tests = 0

        # Get validation tests from config
        validation_tests = self.config.get('validation_tests', [])

        for test_config in validation_tests:
            if not test_config.get('enabled', True):
                continue

            total_tests += 1
            test_name = test_config['name']
            test_type = ValidationType(test_config['type'])

            logger.info(f"Running validation test: {test_name}")

            test_result = await self._run_validation_test(
                test_name, test_type, backup_path, backup_name,
                test_config, expected_checksum, storage_location
            )

            test_results.append(test_result)

            # Update counters
            if test_result.status == ValidationStatus.PASSED:
                passed_tests += 1
            elif test_result.status == ValidationStatus.FAILED:
                if test_config.get('critical', False):
                    failed_tests += 1
                else:
                    warning_tests += 1
            elif test_result.status == ValidationStatus.SKIPPED:
                skipped_tests += 1
            elif test_result.status == ValidationStatus.WARNING:
                warning_tests += 1

        # Determine overall status
        if failed_tests > 0:
            overall_status = ValidationStatus.FAILED
        elif warning_tests > 0:
            overall_status = ValidationStatus.WARNING
        else:
            overall_status = ValidationStatus.PASSED

        # Generate summary and recommendations
        summary = self._generate_summary(test_results)
        recommendations = self._generate_recommendations(test_results)

        # Create validation report
        report = BackupValidationReport(
            backup_id=backup_id,
            backup_name=backup_name,
            backup_path=backup_path,
            validation_timestamp=validation_timestamp,
            overall_status=overall_status,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            skipped_tests=skipped_tests,
            warning_tests=warning_tests,
            test_results=test_results,
            summary=summary,
            recommendations=recommendations
        )

        logger.info(f"Validation completed for {backup_name}: {overall_status.value}")

        return report

    async def _run_validation_test(self, test_name: str, test_type: ValidationType,
                                 backup_path: str, backup_name: str,
                                 test_config: Dict, expected_checksum: str = None,
                                 storage_location: Dict = None) -> ValidationResult:
        """Run a single validation test"""

        start_time = datetime.now()
        details = {}
        error_message = None
        warnings = []

        try:
            if test_type == ValidationType.FILE_INTEGRITY:
                details = await self.validators['file_integrity'].validate_file_integrity(backup_path)
                status = ValidationStatus.PASSED if all(details.values()) else ValidationStatus.FAILED

            elif test_type == ValidationType.CHECKSUM_VERIFICATION:
                if expected_checksum:
                    details = await self.validators['checksum'].verify_checksum(
                        backup_path, expected_checksum, self.config.get('checksum_algorithm', 'sha256')
                    )
                    status = ValidationStatus.PASSED if details['valid'] else ValidationStatus.FAILED
                else:
                    # Calculate checksum instead
                    details = await self.validators['checksum'].calculate_checksum(
                        backup_path, self.config.get('checksum_algorithm', 'sha256')
                    )
                    status = ValidationStatus.PASSED if details['success'] else ValidationStatus.FAILED
                    warnings.append("No expected checksum provided, calculated new checksum")

            elif test_type == ValidationType.ACCESSIBILITY_TEST:
                if storage_location:
                    if storage_location.get('type') == 's3':
                        details = await self.validators['accessibility'].test_s3_accessibility(
                            storage_location['bucket'], storage_location['key']
                        )
                    else:
                        details = await self.validators['accessibility'].test_local_accessibility(
                            storage_location.get('path', backup_path)
                        )
                    status = ValidationStatus.PASSED if details['accessible'] else ValidationStatus.FAILED
                else:
                    details = await self.validators['accessibility'].test_local_accessibility(backup_path)
                    status = ValidationStatus.PASSED if details['accessible'] else ValidationStatus.FAILED

            elif test_type == ValidationType.DATABASE_RESTORE_TEST:
                test_db = f"{self.config.get('test_database_prefix', 'test_restore_')}{int(time.time())}"
                details = await self.validators['database_restore'].test_postgresql_restore(
                    backup_path, test_db
                )
                status = ValidationStatus.PASSED if details['restore_successful'] else ValidationStatus.FAILED

            elif test_type == ValidationType.FILE_EXTRACTION_TEST:
                if backup_path.endswith('.tar') or backup_path.endswith('.tar.gz'):
                    details = await self.validators['file_extraction'].test_tar_extraction(backup_path)
                elif backup_path.endswith('.gz'):
                    details = await self.validators['file_extraction'].test_gzip_extraction(backup_path)
                else:
                    details = {'error': 'Unsupported file type for extraction test'}
                    status = ValidationStatus.SKIPPED
                status = ValidationStatus.PASSED if details.get('extraction_successful') else ValidationStatus.FAILED

            elif test_type == ValidationType.ENCRYPTION_VERIFICATION:
                if backup_path.endswith('.enc'):
                    details = await self.validators['encryption'].test_encryption_decryption(backup_path)
                    status = ValidationStatus.PASSED if details.get('decryption_successful') else ValidationStatus.FAILED
                else:
                    details = {'info': 'File is not encrypted'}
                    status = ValidationStatus.SKIPPED

            else:
                details = {'error': f'Unsupported validation type: {test_type}'}
                status = ValidationStatus.FAILED

        except Exception as e:
            error_message = str(e)
            status = ValidationStatus.FAILED
            details['error'] = error_message

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        return ValidationResult(
            test_name=test_name,
            status=status,
            start_time=start_time,
            end_time=end_time,
            duration_seconds=duration,
            details=details,
            error_message=error_message,
            warnings=warnings
        )

    def _generate_summary(self, test_results: List[ValidationResult]) -> Dict[str, Any]:
        """Generate validation summary"""
        total_duration = sum(result.duration_seconds for result in test_results)
        critical_failures = [r for r in test_results if r.status == ValidationStatus.FAILED]

        return {
            'total_validation_time': total_duration,
            'average_test_time': total_duration / len(test_results) if test_results else 0,
            'critical_failures_count': len(critical_failures),
            'critical_failures': [r.test_name for r in critical_failures],
            'tests_with_warnings': [r.test_name for r in test_results if r.warnings],
            'fastest_test': min(test_results, key=lambda r: r.duration_seconds).test_name if test_results else None,
            'slowest_test': max(test_results, key=lambda r: r.duration_seconds).test_name if test_results else None
        }

    def _generate_recommendations(self, test_results: List[ValidationResult]) -> List[str]:
        """Generate recommendations based on test results"""
        recommendations = []

        for result in test_results:
            if result.status == ValidationStatus.FAILED:
                if 'checksum' in result.test_name.lower():
                    recommendations.append("Backup appears to be corrupted. Consider creating a new backup.")
                elif 'accessibility' in result.test_name.lower():
                    recommendations.append("Storage accessibility issues detected. Check storage configuration and permissions.")
                elif 'restore' in result.test_name.lower():
                    recommendations.append("Database restore test failed. Backup may be incomplete or corrupted.")
                elif 'integrity' in result.test_name.lower():
                    recommendations.append("File integrity issues detected. Investigate backup creation process.")

            elif result.warnings:
                recommendations.extend([f"Warning for {result.test_name}: {warning}" for warning in result.warnings])

        if not recommendations:
            recommendations.append("All validation tests passed successfully. Backup appears to be healthy.")

        return recommendations

    def generate_report_json(self, report: BackupValidationReport) -> str:
        """Generate JSON validation report"""
        def datetime_converter(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        report_dict = {
            'backup_id': report.backup_id,
            'backup_name': report.backup_name,
            'backup_path': report.backup_path,
            'validation_timestamp': report.validation_timestamp,
            'overall_status': report.overall_status.value,
            'summary': {
                'total_tests': report.total_tests,
                'passed_tests': report.passed_tests,
                'failed_tests': report.failed_tests,
                'skipped_tests': report.skipped_tests,
                'warning_tests': report.warning_tests,
                'success_rate': (report.passed_tests / report.total_tests * 100) if report.total_tests > 0 else 0
            },
            'test_results': [],
            'summary_details': report.summary,
            'recommendations': report.recommendations
        }

        for result in report.test_results:
            test_result_dict = {
                'test_name': result.test_name,
                'status': result.status.value,
                'start_time': result.start_time,
                'end_time': result.end_time,
                'duration_seconds': result.duration_seconds,
                'details': result.details
            }
            if result.error_message:
                test_result_dict['error_message'] = result.error_message
            if result.warnings:
                test_result_dict['warnings'] = result.warnings
            report_dict['test_results'].append(test_result_dict)

        return json.dumps(report_dict, indent=2, default=datetime_converter)

    def generate_report_html(self, report: BackupValidationReport) -> str:
        """Generate HTML validation report"""
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Backup Validation Report - {backup_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }}
                .status-passed {{ color: #28a745; }}
                .status-failed {{ color: #dc3545; }}
                .status-warning {{ color: #ffc107; }}
                .status-skipped {{ color: #6c757d; }}
                .test-result {{ margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }}
                .summary {{ background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                .recommendations {{ background: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background-color: #f2f2f2; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Backup Validation Report</h1>
                <h2>{backup_name}</h2>
                <p><strong>Validation Time:</strong> {validation_timestamp}</p>
                <p><strong>Overall Status:</strong> <span class="status-{overall_status}">{overall_status_upper}</span></p>
            </div>

            <div class="summary">
                <h3>Summary</h3>
                <p><strong>Total Tests:</strong> {total_tests}</p>
                <p><strong>Passed:</strong> {passed_tests}</p>
                <p><strong>Failed:</strong> {failed_tests}</p>
                <p><strong>Warnings:</strong> {warning_tests}</p>
                <p><strong>Skipped:</strong> {skipped_tests}</p>
                <p><strong>Success Rate:</strong> {success_rate:.1f}%</p>
            </div>

            <h3>Test Results</h3>
            <table>
                <tr>
                    <th>Test Name</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Details</th>
                </tr>
                {test_rows}
            </table>

            {recommendations_section}

            <div class="summary">
                <h3>Performance Summary</h3>
                <p><strong>Total Validation Time:</strong> {total_validation_time:.2f} seconds</p>
                <p><strong>Average Test Time:</strong> {average_test_time:.2f} seconds</p>
                <p><strong>Fastest Test:</strong> {fastest_test}</p>
                <p><strong>Slowest Test:</strong> {slowest_test}</p>
            </div>
        </body>
        </html>
        """

        # Generate test result rows
        test_rows = ""
        for result in report.test_results:
            status_class = f"status-{result.status.value}"
            details_text = str(result.details)[:100] + "..." if len(str(result.details)) > 100 else str(result.details)

            test_rows += f"""
                <tr>
                    <td>{result.test_name}</td>
                    <td class="{status_class}">{result.status.value.upper()}</td>
                    <td>{result.duration_seconds:.2f}s</td>
                    <td>{details_text}</td>
                </tr>
            """

        # Generate recommendations section
        recommendations_section = ""
        if report.recommendations:
            recommendations_html = "<ul>"
            for rec in report.recommendations:
                recommendations_html += f"<li>{rec}</li>"
            recommendations_html += "</ul>"

            recommendations_section = f"""
                <div class="recommendations">
                    <h3>Recommendations</h3>
                    {recommendations_html}
                </div>
            """

        # Calculate success rate
        success_rate = (report.passed_tests / report.total_tests * 100) if report.total_tests > 0 else 0

        return html_template.format(
            backup_name=report.backup_name,
            validation_timestamp=report.validation_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
            overall_status=report.overall_status.value,
            overall_status_status=report.overall_status.value.upper(),
            total_tests=report.total_tests,
            passed_tests=report.passed_tests,
            failed_tests=report.failed_tests,
            warning_tests=report.warning_tests,
            skipped_tests=report.skipped_tests,
            success_rate=success_rate,
            test_rows=test_rows,
            recommendations_section=recommendations_section,
            total_validation_time=report.summary.get('total_validation_time', 0),
            average_test_time=report.summary.get('average_test_time', 0),
            fastest_test=report.summary.get('fastest_test', 'N/A'),
            slowest_test=report.summary.get('slowest_test', 'N/A')
        )


async def main():
    """Main function for backup validator"""
    validator = BackupValidator()

    # Example validation
    backup_path = "/tmp/test-backup.dump"
    backup_name = "Test Database Backup"
    expected_checksum = None

    if os.path.exists(backup_path):
        try:
            report = await validator.validate_backup(backup_path, backup_name, expected_checksum)

            # Generate reports
            json_report = validator.generate_report_json(report)
            html_report = validator.generate_report_html(report)

            # Save reports
            with open(f"validation-report-{backup_name.replace(' ', '-').lower()}.json", "w") as f:
                f.write(json_report)

            with open(f"validation-report-{backup_name.replace(' ', '-').lower()}.html", "w") as f:
                f.write(html_report)

            print(f"Validation completed: {report.overall_status.value}")
            print(f"Report saved: validation-report-{backup_name.replace(' ', '-').lower()}.json")

        except Exception as e:
            print(f"Validation failed: {e}")
    else:
        print(f"Backup file not found: {backup_path}")


if __name__ == "__main__":
    asyncio.run(main())