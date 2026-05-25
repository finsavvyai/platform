#!/usr/bin/env python3
"""
QuantumBeam Automated Backup Manager
Comprehensive data backup and recovery system with scheduling and validation
"""

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
import psycopg2
from psycopg2.extras import execute_values
import redis
import subprocess
import shutil
import hashlib
import gzip
import tarfile
import tempfile
from pathlib import Path
import schedule
import threading
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import requests
from cryptography.fernet import Fernet
import jwt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/quantumbeam/backup-manager.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class BackupStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    VALIDATED = "validated"
    EXPIRED = "expired"


class BackupType(Enum):
    DATABASE = "database"
    FILES = "files"
    CONFIGURATION = "configuration"
    LOGS = "logs"
    METRICS = "metrics"
    COMPLETE = "complete"


class StorageType(Enum):
    LOCAL = "local"
    S3 = "s3"
    GCS = "gcs"
    AZURE = "azure"
    NFS = "nfs"


@dataclass
class BackupJob:
    """Backup job configuration"""
    id: str
    name: str
    backup_type: BackupType
    source_paths: List[str]
    schedule_cron: str
    retention_days: int
    storage_type: StorageType
    storage_config: Dict[str, Any]
    encryption_enabled: bool
    compression_enabled: bool
    validation_enabled: bool
    notification_settings: Dict[str, Any]
    status: BackupStatus
    created_at: datetime
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    size_bytes: int = 0
    duration_seconds: int = 0
    checksum: Optional[str] = None
    metadata: Dict[str, Any] = None


@dataclass
class BackupResult:
    """Result of a backup operation"""
    job_id: str
    status: BackupStatus
    start_time: datetime
    end_time: datetime
    size_bytes: int
    file_count: int
    storage_location: str
    checksum: str
    error_message: Optional[str] = None
    validation_result: Optional[Dict] = None


class DatabaseBackup:
    """Database-specific backup operations"""

    def __init__(self, db_config: Dict[str, Any]):
        self.db_config = db_config
        self.connection = None

    def get_connection(self):
        """Get database connection"""
        if not self.connection:
            self.connection = psycopg2.connect(
                host=self.db_config['host'],
                port=self.db_config['port'],
                database=self.db_config['database'],
                user=self.db_config['username'],
                password=self.db_config['password']
            )
        return self.connection

    async def create_dump(self, output_path: str) -> Dict:
        """Create database dump"""
        try:
            # Use pg_dump for PostgreSQL
            cmd = [
                'pg_dump',
                '-h', self.db_config['host'],
                '-p', str(self.db_config['port']),
                '-U', self.db_config['username'],
                '-d', self.db_config['database'],
                '-f', output_path,
                '--format=custom',
                '--verbose',
                '--no-password'
            ]

            # Set password environment variable
            env = os.environ.copy()
            env['PGPASSWORD'] = self.db_config['password']

            # Execute dump command
            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")

            # Get file size
            file_size = os.path.getsize(output_path)

            # Get table count for validation
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
            table_count = cursor.fetchone()[0]
            cursor.close()

            return {
                'file_size': file_size,
                'table_count': table_count,
                'output_path': output_path
            }

        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            raise

    async def validate_dump(self, dump_path: str) -> Dict:
        """Validate database dump"""
        try:
            # Check file exists and is readable
            if not os.path.exists(dump_path):
                return {'valid': False, 'error': 'Dump file does not exist'}

            # Check file size
            file_size = os.path.getsize(dump_path)
            if file_size == 0:
                return {'valid': False, 'error': 'Dump file is empty'}

            # Validate dump file integrity using pg_restore --list
            cmd = [
                'pg_restore',
                '--list',
                dump_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )

            if result.returncode != 0:
                return {
                    'valid': False,
                    'error': f'Dump file validation failed: {result.stderr}'
                }

            # Count objects in dump
            object_count = len(result.stdout.strip().split('\n')) if result.stdout.strip() else 0

            return {
                'valid': True,
                'file_size': file_size,
                'object_count': object_count,
                'validation_time': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Dump validation failed: {e}")
            return {'valid': False, 'error': str(e)}


class RedisBackup:
    """Redis-specific backup operations"""

    def __init__(self, redis_config: Dict[str, Any]):
        self.redis_config = redis_config
        self.redis_client = None

    def get_connection(self):
        """Get Redis connection"""
        if not self.redis_client:
            self.redis_client = redis.Redis(
                host=self.redis_config['host'],
                port=self.redis_config['port'],
                password=self.redis_config.get('password'),
                decode_responses=True
            )
        return self.redis_client

    async def create_backup(self, output_path: str) -> Dict:
        """Create Redis backup"""
        try:
            r = self.get_connection()

            # Create background save
            save_result = r.save()
            if not save_result:
                raise Exception("Redis BGSAVE command failed")

            # Wait for save to complete
            for _ in range(60):  # Wait up to 60 seconds
                lastsave = r.lastsave()
                if lastsave:
                    break
                await asyncio.sleep(1)

            # Get RDB file path from Redis config
            config = r.config_get('dir')
            rdb_dir = config.get('dir', '/var/lib/redis')

            config = r.config_get('dbfilename')
            rdb_filename = config.get('dbfilename', 'dump.rdb')

            rdb_path = os.path.join(rdb_dir, rdb_filename)

            # Copy RDB file to output path
            shutil.copy2(rdb_path, output_path)

            # Get Redis info for validation
            info = r.info()

            return {
                'file_size': os.path.getsize(output_path),
                'keys_count': info.get('db0', {}).get('keys', 0),
                'used_memory': info.get('used_memory', 0),
                'output_path': output_path,
                'save_time': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Redis backup failed: {e}")
            raise


class StorageManager:
    """Manages different storage backends for backups"""

    def __init__(self, storage_config: Dict[str, Any]):
        self.storage_config = storage_config
        self.s3_client = None
        self.gcs_client = None

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

    async def upload_file(self, local_path: str, remote_path: str, storage_type: StorageType) -> Dict:
        """Upload file to specified storage"""
        try:
            if storage_type == StorageType.S3:
                return await self._upload_to_s3(local_path, remote_path)
            elif storage_type == StorageType.LOCAL:
                return await self._upload_to_local(local_path, remote_path)
            elif storage_type == StorageType.NFS:
                return await self._upload_to_nfs(local_path, remote_path)
            else:
                raise ValueError(f"Unsupported storage type: {storage_type}")

        except Exception as e:
            logger.error(f"Upload failed: {e}")
            raise

    async def _upload_to_s3(self, local_path: str, remote_path: str) -> Dict:
        """Upload file to S3"""
        try:
            s3 = self.get_s3_client()
            bucket_name = self.storage_config['bucket_name']

            # Upload file
            s3.upload_file(local_path, bucket_name, remote_path)

            # Generate presigned URL for validation
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': remote_path},
                ExpiresIn=3600
            )

            # Get object metadata
            response = s3.head_object(Bucket=bucket_name, Key=remote_path)

            return {
                'storage_type': 's3',
                'bucket': bucket_name,
                'key': remote_path,
                'url': url,
                'size': response['ContentLength'],
                'etag': response['ETag'].strip('"'),
                'last_modified': response['LastModified'].isoformat()
            }

        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    async def _upload_to_local(self, local_path: str, remote_path: str) -> Dict:
        """Upload file to local storage"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(remote_path), exist_ok=True)

            # Copy file
            shutil.copy2(local_path, remote_path)

            # Get file info
            stat = os.stat(remote_path)

            return {
                'storage_type': 'local',
                'path': remote_path,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            }

        except Exception as e:
            logger.error(f"Local upload failed: {e}")
            raise

    async def _upload_to_nfs(self, local_path: str, remote_path: str) -> Dict:
        """Upload file to NFS storage"""
        try:
            nfs_mount = self.storage_config['nfs_mount']
            full_remote_path = os.path.join(nfs_mount, remote_path)

            # Ensure directory exists
            os.makedirs(os.path.dirname(full_remote_path), exist_ok=True)

            # Copy file
            shutil.copy2(local_path, full_remote_path)

            # Get file info
            stat = os.stat(full_remote_path)

            return {
                'storage_type': 'nfs',
                'path': full_remote_path,
                'size': stat.st_size,
                'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
            }

        except Exception as e:
            logger.error(f"NFS upload failed: {e}")
            raise

    async def download_file(self, remote_path: str, local_path: str, storage_type: StorageType) -> bool:
        """Download file from storage"""
        try:
            if storage_type == StorageType.S3:
                s3 = self.get_s3_client()
                bucket_name = self.storage_config['bucket_name']
                s3.download_file(bucket_name, remote_path, local_path)
            elif storage_type == StorageType.LOCAL:
                shutil.copy2(remote_path, local_path)
            elif storage_type == StorageType.NFS:
                nfs_mount = self.storage_config['nfs_mount']
                full_remote_path = os.path.join(nfs_mount, remote_path)
                shutil.copy2(full_remote_path, local_path)
            else:
                raise ValueError(f"Unsupported storage type: {storage_type}")

            return True

        except Exception as e:
            logger.error(f"Download failed: {e}")
            return False

    async def list_backups(self, prefix: str = "", storage_type: StorageType = None) -> List[Dict]:
        """List available backups"""
        try:
            if storage_type == StorageType.S3:
                s3 = self.get_s3_client()
                bucket_name = self.storage_config['bucket_name']

                response = s3.list_objects_v2(
                    Bucket=bucket_name,
                    Prefix=prefix
                )

                backups = []
                for obj in response.get('Contents', []):
                    backups.append({
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'].isoformat(),
                        'etag': obj['ETag'].strip('"')
                    })

                return backups

            elif storage_type == StorageType.LOCAL:
                backups = []
                backup_dir = self.storage_config.get('backup_dir', '/var/backups/quantumbeam')
                base_path = os.path.join(backup_dir, prefix)

                if os.path.exists(base_path):
                    for root, dirs, files in os.walk(base_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            stat = os.stat(file_path)
                            relative_path = os.path.relpath(file_path, backup_dir)
                            backups.append({
                                'key': relative_path,
                                'size': stat.st_size,
                                'last_modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
                            })

                return backups

            else:
                return []

        except Exception as e:
            logger.error(f"List backups failed: {e}")
            return []


class BackupValidator:
    """Validates backup integrity and completeness"""

    def __init__(self):
        pass

    async def validate_backup(self, backup_path: str, backup_type: BackupType) -> Dict:
        """Validate backup file"""
        try:
            validation_result = {
                'valid': False,
                'checks': {},
                'validation_time': datetime.now().isoformat()
            }

            # Check file exists
            if not os.path.exists(backup_path):
                validation_result['checks']['file_exists'] = {
                    'passed': False,
                    'error': 'Backup file does not exist'
                }
                return validation_result

            validation_result['checks']['file_exists'] = {'passed': True}

            # Check file size
            file_size = os.path.getsize(backup_path)
            validation_result['checks']['file_size'] = {
                'passed': file_size > 0,
                'size_bytes': file_size
            }

            # Calculate checksum
            checksum = self._calculate_checksum(backup_path)
            validation_result['checks']['checksum'] = {
                'passed': True,
                'checksum': checksum
            }

            # Type-specific validation
            if backup_type == BackupType.DATABASE:
                db_validator = DatabaseBackup({})
                db_result = await db_validator.validate_dump(backup_path)
                validation_result['checks']['database_integrity'] = db_result

            # Test file can be opened/read
            try:
                with open(backup_path, 'rb') as f:
                    # Read first 1KB to test file integrity
                    f.read(1024)
                validation_result['checks']['file_readable'] = {'passed': True}
            except Exception as e:
                validation_result['checks']['file_readable'] = {
                    'passed': False,
                    'error': str(e)
                }

            # Overall validation result
            all_passed = all(check.get('passed', False) for check in validation_result['checks'].values())
            validation_result['valid'] = all_passed

            return validation_result

        except Exception as e:
            logger.error(f"Backup validation failed: {e}")
            return {
                'valid': False,
                'error': str(e),
                'validation_time': datetime.now().isoformat()
            }

    def _calculate_checksum(self, file_path: str) -> str:
        """Calculate SHA-256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()


class NotificationManager:
    """Manages backup notifications and alerts"""

    def __init__(self, notification_config: Dict[str, Any]):
        self.notification_config = notification_config

    async def send_backup_success(self, job: BackupJob, result: BackupResult):
        """Send backup success notification"""
        await self._send_notification(
            subject=f"Backup Successful: {job.name}",
            message=self._format_success_message(job, result),
            severity="info"
        )

    async def send_backup_failure(self, job: BackupJob, error_message: str):
        """Send backup failure notification"""
        await self._send_notification(
            subject=f"Backup Failed: {job.name}",
            message=self._format_failure_message(job, error_message),
            severity="critical"
        )

    async def send_validation_failure(self, job: BackupJob, validation_result: Dict):
        """Send validation failure notification"""
        await self._send_notification(
            subject=f"Backup Validation Failed: {job.name}",
            message=self._format_validation_message(job, validation_result),
            severity="warning"
        )

    async def _send_notification(self, subject: str, message: str, severity: str):
        """Send notification via configured channels"""
        try:
            # Email notification
            if self.notification_config.get('email', {}).get('enabled'):
                await self._send_email(subject, message)

            # Slack notification
            if self.notification_config.get('slack', {}).get('enabled'):
                await self._send_slack(subject, message, severity)

            # Webhook notification
            if self.notification_config.get('webhook', {}).get('enabled'):
                await self._send_webhook(subject, message, severity)

        except Exception as e:
            logger.error(f"Failed to send notification: {e}")

    async def _send_email(self, subject: str, message: str):
        """Send email notification"""
        try:
            email_config = self.notification_config['email']
            smtp_config = email_config['smtp']

            msg = MimeMultipart()
            msg['From'] = smtp_config['from']
            msg['To'] = ', '.join(email_config['recipients'])
            msg['Subject'] = subject

            msg.attach(MimeText(message, 'plain'))

            with smtplib.SMTP(smtp_config['host'], smtp_config['port']) as server:
                if smtp_config.get('use_tls'):
                    server.starttls()
                if smtp_config.get('username'):
                    server.login(smtp_config['username'], smtp_config['password'])
                server.send_message(msg)

        except Exception as e:
            logger.error(f"Email notification failed: {e}")

    async def _send_slack(self, subject: str, message: str, severity: str):
        """Send Slack notification"""
        try:
            slack_config = self.notification_config['slack']
            webhook_url = slack_config['webhook_url']

            color = {
                'info': 'good',
                'warning': 'warning',
                'critical': 'danger'
            }.get(severity, 'good')

            payload = {
                'text': subject,
                'attachments': [
                    {
                        'color': color,
                        'text': message
                    }
                ]
            }

            response = requests.post(webhook_url, json=payload)
            response.raise_for_status()

        except Exception as e:
            logger.error(f"Slack notification failed: {e}")

    async def _send_webhook(self, subject: str, message: str, severity: str):
        """Send webhook notification"""
        try:
            webhook_config = self.notification_config['webhook']
            webhook_url = webhook_config['url']

            payload = {
                'subject': subject,
                'message': message,
                'severity': severity,
                'timestamp': datetime.now().isoformat(),
                'service': 'quantumbeam-backup-manager'
            }

            headers = webhook_config.get('headers', {})
            response = requests.post(webhook_url, json=payload, headers=headers)
            response.raise_for_status()

        except Exception as e:
            logger.error(f"Webhook notification failed: {e}")

    def _format_success_message(self, job: BackupJob, result: BackupResult) -> str:
        """Format success notification message"""
        return f"""
Backup completed successfully!

Job Details:
- Name: {job.name}
- Type: {job.backup_type.value}
- Storage: {job.storage_type.value}
- Size: {self._format_bytes(result.size_bytes)}
- Duration: {result.duration_seconds}s
- Location: {result.storage_location}
- Checksum: {result.checksum[:16]}...

Completed at: {result.end_time.isoformat()}
"""

    def _format_failure_message(self, job: BackupJob, error_message: str) -> str:
        """Format failure notification message"""
        return f"""
Backup failed!

Job Details:
- Name: {job.name}
- Type: {job.backup_type.value}
- Storage: {job.storage_type.value}

Error: {error_message}

Failed at: {datetime.now().isoformat()}
"""

    def _format_validation_message(self, job: BackupJob, validation_result: Dict) -> str:
        """Format validation failure message"""
        return f"""
Backup validation failed!

Job Details:
- Name: {job.name}
- Type: {job.backup_type.value}

Validation Result: {json.dumps(validation_result, indent=2)}

Validation Time: {datetime.now().isoformat()}
"""

    def _format_bytes(self, bytes_value: int) -> str:
        """Format bytes in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024
        return f"{bytes_value:.1f} PB"


class BackupManager:
    """Main backup management system"""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'backup-config.yaml'
        self.config = self._load_config()
        self.jobs: List[BackupJob] = []
        self.storage_manager = StorageManager(self.config.get('storage', {}))
        self.validator = BackupValidator()
        self.notification_manager = NotificationManager(self.config.get('notifications', {}))
        self.scheduler_thread = None
        self.scheduler_running = False
        self.encryption_key = self._get_encryption_key()

        # Load existing jobs
        self._load_jobs()

    def _load_config(self) -> Dict:
        """Load backup configuration"""
        try:
            with open(self.config_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.warning(f"Config file {self.config_file} not found, using defaults")
            return self._get_default_config()

    def _get_default_config(self) -> Dict:
        """Get default configuration"""
        return {
            'storage': {
                'type': 's3',
                's3': {
                    'bucket_name': 'quantumbeam-backups',
                    'region': 'us-east-1'
                }
            },
            'encryption': {
                'enabled': True,
                'key_file': '/etc/quantumbeam/backup-key.key'
            },
            'compression': {
                'enabled': True,
                'algorithm': 'gzip'
            },
            'notifications': {
                'email': {
                    'enabled': True,
                    'smtp': {
                        'host': 'smtp.gmail.com',
                        'port': 587,
                        'use_tls': True,
                        'from': 'backups@quantumbeam.io'
                    },
                    'recipients': ['admin@quantumbeam.io']
                },
                'slack': {
                    'enabled': True,
                    'webhook_url': '${SLACK_WEBHOOK_URL}'
                }
            },
            'retention': {
                'default_days': 30,
                'max_storage_gb': 1000
            }
        }

    def _load_jobs(self):
        """Load backup jobs from storage"""
        # For now, create default jobs
        # In production, this would load from database or config file
        default_jobs = [
            {
                'name': 'PostgreSQL Database Backup',
                'backup_type': BackupType.DATABASE,
                'source_paths': ['postgresql://quantumbeam:password@localhost:5432/quantumbeam'],
                'schedule_cron': '0 2 * * *',  # Daily at 2 AM
                'retention_days': 30,
                'storage_type': StorageType.S3,
                'storage_config': {'bucket_prefix': 'database'},
                'encryption_enabled': True,
                'compression_enabled': True,
                'validation_enabled': True,
                'notification_settings': {
                    'on_success': True,
                    'on_failure': True,
                    'on_validation_failure': True
                }
            },
            {
                'name': 'Application Files Backup',
                'backup_type': BackupType.FILES,
                'source_paths': ['/opt/quantumbeam', '/etc/quantumbeam'],
                'schedule_cron': '0 3 * * *',  # Daily at 3 AM
                'retention_days': 14,
                'storage_type': StorageType.S3,
                'storage_config': {'bucket_prefix': 'files'},
                'encryption_enabled': True,
                'compression_enabled': True,
                'validation_enabled': True,
                'notification_settings': {
                    'on_success': True,
                    'on_failure': True,
                    'on_validation_failure': True
                }
            }
        ]

        for job_config in default_jobs:
            self.create_backup_job(**job_config)

    def _get_encryption_key(self) -> Optional[bytes]:
        """Get encryption key for backup encryption"""
        if not self.config.get('encryption', {}).get('enabled'):
            return None

        key_file = self.config['encryption'].get('key_file', '/etc/quantumbeam/backup-key.key')

        try:
            if os.path.exists(key_file):
                with open(key_file, 'rb') as f:
                    return f.read()
            else:
                # Generate new key
                key = Fernet.generate_key()
                os.makedirs(os.path.dirname(key_file), exist_ok=True)
                with open(key_file, 'wb') as f:
                    f.write(key)
                os.chmod(key_file, 0o600)  # Restrict permissions
                return key
        except Exception as e:
            logger.error(f"Failed to load/generate encryption key: {e}")
            return None

    def create_backup_job(self, name: str, backup_type: BackupType, source_paths: List[str],
                         schedule_cron: str, retention_days: int, storage_type: StorageType,
                         storage_config: Dict[str, Any], encryption_enabled: bool,
                         compression_enabled: bool, validation_enabled: bool,
                         notification_settings: Dict[str, Any]) -> str:
        """Create a new backup job"""

        job_id = f"backup-{int(time.time())}-{hash(name) % 10000}"

        job = BackupJob(
            id=job_id,
            name=name,
            backup_type=backup_type,
            source_paths=source_paths,
            schedule_cron=schedule_cron,
            retention_days=retention_days,
            storage_type=storage_type,
            storage_config=storage_config,
            encryption_enabled=encryption_enabled,
            compression_enabled=compression_enabled,
            validation_enabled=validation_enabled,
            notification_settings=notification_settings,
            status=BackupStatus.PENDING,
            created_at=datetime.now(),
            metadata={}
        )

        self.jobs.append(job)

        # Schedule the job
        schedule.every().day.at(schedule_cron.split()[1]).do(self.run_backup_job, job_id)

        logger.info(f"Created backup job: {job_id} - {name}")
        return job_id

    async def run_backup_job(self, job_id: str) -> BackupResult:
        """Execute a backup job"""
        job = self._get_job(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job.status = BackupStatus.RUNNING
        start_time = datetime.now()

        logger.info(f"Starting backup job: {job.name}")

        try:
            # Create temporary directory for backup
            with tempfile.TemporaryDirectory() as temp_dir:
                backup_filename = f"{job.name.replace(' ', '-').lower()}-{start_time.strftime('%Y%m%d-%H%M%S')}"

                if job.backup_type == BackupType.DATABASE:
                    backup_path = await self._backup_database(job, temp_dir, backup_filename)
                elif job.backup_type == BackupType.FILES:
                    backup_path = await self._backup_files(job, temp_dir, backup_filename)
                else:
                    raise ValueError(f"Unsupported backup type: {job.backup_type}")

                # Compress if enabled
                if job.compression_enabled:
                    backup_path = await self._compress_file(backup_path)

                # Encrypt if enabled
                if job.encryption_enabled and self.encryption_key:
                    backup_path = await self._encrypt_file(backup_path)

                # Calculate checksum
                checksum = self.validator._calculate_checksum(backup_path)

                # Upload to storage
                storage_path = f"{job.storage_config.get('bucket_prefix', job.backup_type.value)}/{os.path.basename(backup_path)}"
                storage_info = await self.storage_manager.upload_file(
                    backup_path, storage_path, job.storage_type
                )

                # Validate backup if enabled
                validation_result = None
                if job.validation_enabled:
                    validation_result = await self.validator.validate_backup(
                        backup_path, job.backup_type
                    )

                end_time = datetime.now()
                duration = int((end_time - start_time).total_seconds())
                file_size = os.path.getsize(backup_path)

                # Create result
                result = BackupResult(
                    job_id=job_id,
                    status=BackupStatus.COMPLETED,
                    start_time=start_time,
                    end_time=end_time,
                    size_bytes=file_size,
                    file_count=1,  # Simplified for now
                    storage_location=storage_info.get('url', storage_path),
                    checksum=checksum,
                    validation_result=validation_result
                )

                # Update job
                job.status = BackupStatus.COMPLETED
                job.last_run = start_time
                job.size_bytes = file_size
                job.duration_seconds = duration
                job.checksum = checksum

                # Send success notification
                if job.notification_settings.get('on_success'):
                    await self.notification_manager.send_backup_success(job, result)

                logger.info(f"Backup job completed successfully: {job.name}")
                return result

        except Exception as e:
            error_message = str(e)
            job.status = BackupStatus.FAILED
            job.last_run = start_time

            # Send failure notification
            if job.notification_settings.get('on_failure'):
                await self.notification_manager.send_backup_failure(job, error_message)

            logger.error(f"Backup job failed: {job.name} - {error_message}")
            raise

    async def _backup_database(self, job: BackupJob, temp_dir: str, filename: str) -> str:
        """Backup database"""
        db_config = self._parse_database_url(job.source_paths[0])
        db_backup = DatabaseBackup(db_config)

        backup_path = os.path.join(temp_dir, f"{filename}.dump")
        result = await db_backup.create_dump(backup_path)

        job.metadata.update(result)
        return backup_path

    async def _backup_files(self, job: BackupJob, temp_dir: str, filename: str) -> str:
        """Backup files"""
        backup_path = os.path.join(temp_dir, f"{filename}.tar")

        with tarfile.open(backup_path, 'w') as tar:
            for source_path in job.source_paths:
                if os.path.exists(source_path):
                    tar.add(source_path, arcname=os.path.basename(source_path))

        return backup_path

    async def _compress_file(self, file_path: str) -> str:
        """Compress file using gzip"""
        compressed_path = f"{file_path}.gz"

        with open(file_path, 'rb') as f_in:
            with gzip.open(compressed_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Remove original file
        os.remove(file_path)
        return compressed_path

    async def _encrypt_file(self, file_path: str) -> str:
        """Encrypt file using Fernet"""
        if not self.encryption_key:
            return file_path

        encrypted_path = f"{file_path}.enc"
        cipher = Fernet(self.encryption_key)

        with open(file_path, 'rb') as f_in:
            with open(encrypted_path, 'wb') as f_out:
                f_out.write(cipher.encrypt(f_in.read()))

        # Remove original file
        os.remove(file_path)
        return encrypted_path

    def _parse_database_url(self, db_url: str) -> Dict[str, Any]:
        """Parse database URL into connection parameters"""
        # Simplified parsing - in production, use proper URL parsing
        if db_url.startswith('postgresql://'):
            parts = db_url.replace('postgresql://', '').split('@')
            if len(parts) == 2:
                auth, host_port_db = parts
                username, password = auth.split(':')
                host_port, database = host_port_db.split('/')
                host, port = host_port_db.split(':')

                return {
                    'host': host,
                    'port': int(port),
                    'database': database,
                    'username': username,
                    'password': password
                }

        # Return default config for demo
        return {
            'host': 'localhost',
            'port': 5432,
            'database': 'quantumbeam',
            'username': 'quantumbeam',
            'password': 'password'
        }

    def _get_job(self, job_id: str) -> Optional[BackupJob]:
        """Get backup job by ID"""
        for job in self.jobs:
            if job.id == job_id:
                return job
        return None

    def list_jobs(self) -> List[BackupJob]:
        """List all backup jobs"""
        return self.jobs.copy()

    def start_scheduler(self):
        """Start the backup scheduler"""
        if self.scheduler_running:
            return

        self.scheduler_running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler)
        self.scheduler_thread.daemon = True
        self.scheduler_thread.start()

        logger.info("Backup scheduler started")

    def _run_scheduler(self):
        """Run the scheduler in background thread"""
        while self.scheduler_running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute

    def stop_scheduler(self):
        """Stop the backup scheduler"""
        self.scheduler_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join()
        logger.info("Backup scheduler stopped")

    async def cleanup_old_backups(self):
        """Clean up old backups based on retention policies"""
        try:
            for job in self.jobs:
                cutoff_date = datetime.now() - timedelta(days=job.retention_days)
                prefix = f"{job.storage_config.get('bucket_prefix', job.backup_type.value)}/"

                backups = await self.storage_manager.list_backups(prefix, job.storage_type)

                for backup in backups:
                    backup_date = datetime.fromisoformat(backup['last_modified'])
                    if backup_date < cutoff_date:
                        # Delete old backup
                        await self._delete_backup(backup['key'], job.storage_type)
                        logger.info(f"Deleted old backup: {backup['key']}")

        except Exception as e:
            logger.error(f"Backup cleanup failed: {e}")

    async def _delete_backup(self, backup_key: str, storage_type: StorageType):
        """Delete a backup from storage"""
        try:
            if storage_type == StorageType.S3:
                s3 = self.storage_manager.get_s3_client()
                bucket_name = self.storage_manager.storage_config['bucket_name']
                s3.delete_object(Bucket=bucket_name, Key=backup_key)
            elif storage_type == StorageType.LOCAL:
                backup_dir = self.storage_manager.storage_config.get('backup_dir', '/var/backups/quantumbeam')
                file_path = os.path.join(backup_dir, backup_key)
                if os.path.exists(file_path):
                    os.remove(file_path)

        except Exception as e:
            logger.error(f"Failed to delete backup {backup_key}: {e}")


async def main():
    """Main function for backup manager"""
    manager = BackupManager()

    # Start scheduler
    manager.start_scheduler()

    # Example: Run a backup job immediately
    jobs = manager.list_jobs()
    if jobs:
        print(f"Running backup job: {jobs[0].name}")
        try:
            result = await manager.run_backup_job(jobs[0].id)
            print(f"Backup completed: {result.storage_location}")
        except Exception as e:
            print(f"Backup failed: {e}")

    # Keep running
    try:
        while True:
            await asyncio.sleep(3600)  # Check every hour
            await manager.cleanup_old_backups()
    except KeyboardInterrupt:
        print("Shutting down backup manager...")
        manager.stop_scheduler()


if __name__ == "__main__":
    asyncio.run(main())