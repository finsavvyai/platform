"""
Encrypted Backup Storage Service
"""

import os
import shutil
import tarfile
import gzip
import json
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.services.encryption_service import encryption_service
from app.services.vault_service import vault_service
from app.core.config import settings
from app.core.database import get_db

logger = logging.getLogger(__name__)


class BackupService:
    """Encrypted backup storage service"""
    
    def __init__(self):
        self.backup_dir = Path(getattr(settings, 'BACKUP_DIR', 'backups'))
        self.backup_dir.mkdir(exist_ok=True)
        
        # Backup configuration
        self.retention_days = getattr(settings, 'BACKUP_RETENTION_DAYS', 30)
        self.compression_level = 6
        self.backup_types = ['database', 'files', 'configuration', 'full']
        
        # Encryption settings
        self.backup_encryption_key = None
        self._initialize_backup_key()
    
    def _initialize_backup_key(self) -> None:
        """Initialize backup encryption key"""
        try:
            # Try to get backup key from Vault
            if vault_service:
                backup_key = asyncio.run(vault_service.get_encryption_key("backup_key"))
                if backup_key:
                    self.backup_encryption_key = backup_key
                    logger.info("Backup encryption key loaded from Vault")
                    return
            
            # Fall back to environment variable
            env_key = os.getenv("BACKUP_ENCRYPTION_KEY")
            if env_key:
                self.backup_encryption_key = env_key
                logger.info("Backup encryption key loaded from environment")
                return
            
            # Generate new key for development
            if settings.ENVIRONMENT == "development":
                self.backup_encryption_key = encryption_service.generate_key()
                logger.warning("Generated new backup encryption key for development")
            else:
                logger.error("No backup encryption key found in production")
                
        except Exception as e:
            logger.error(f"Failed to initialize backup encryption key: {e}")
    
    async def create_database_backup(self, db: AsyncSession) -> Dict[str, Any]:
        """Create encrypted database backup"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"database_backup_{timestamp}"
            
            # Create temporary directory for backup
            temp_dir = self.backup_dir / "temp" / backup_name
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Get list of tables
            tables_result = await db.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            )
            tables = [row[0] for row in tables_result.fetchall()]
            
            backup_info = {
                'type': 'database',
                'timestamp': timestamp,
                'tables': [],
                'total_records': 0
            }
            
            # Backup each table
            for table in tables:
                try:
                    # Get table data
                    table_result = await db.execute(text(f"SELECT * FROM {table}"))
                    rows = table_result.fetchall()
                    columns = table_result.keys()
                    
                    # Convert to JSON
                    table_data = {
                        'columns': list(columns),
                        'rows': [dict(zip(columns, row)) for row in rows]
                    }
                    
                    # Save table data to file
                    table_file = temp_dir / f"{table}.json"
                    with open(table_file, 'w') as f:
                        json.dump(table_data, f, default=str, indent=2)
                    
                    backup_info['tables'].append({
                        'name': table,
                        'records': len(rows),
                        'file': f"{table}.json"
                    })
                    backup_info['total_records'] += len(rows)
                    
                    logger.info(f"Backed up table {table}: {len(rows)} records")
                    
                except Exception as e:
                    logger.error(f"Failed to backup table {table}: {e}")
                    continue
            
            # Create backup archive
            archive_path = await self._create_encrypted_archive(temp_dir, backup_name)
            
            # Clean up temporary directory
            shutil.rmtree(temp_dir)
            
            # Save backup metadata
            metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(backup_info, f, indent=2)
            
            logger.info(f"Database backup created: {archive_path}")
            
            return {
                'success': True,
                'backup_name': backup_name,
                'archive_path': str(archive_path),
                'metadata': backup_info
            }
            
        except Exception as e:
            logger.error(f"Database backup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def create_files_backup(self, directories: List[str]) -> Dict[str, Any]:
        """Create encrypted backup of specified directories"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"files_backup_{timestamp}"
            
            # Create temporary directory for backup
            temp_dir = self.backup_dir / "temp" / backup_name
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            backup_info = {
                'type': 'files',
                'timestamp': timestamp,
                'directories': [],
                'total_files': 0,
                'total_size': 0
            }
            
            # Copy directories to temp location
            for directory in directories:
                if os.path.exists(directory):
                    dir_name = os.path.basename(directory)
                    dest_dir = temp_dir / dir_name
                    
                    # Copy directory
                    shutil.copytree(directory, dest_dir)
                    
                    # Calculate directory stats
                    file_count = sum(len(files) for _, _, files in os.walk(dest_dir))
                    dir_size = sum(
                        os.path.getsize(os.path.join(dirpath, filename))
                        for dirpath, _, filenames in os.walk(dest_dir)
                        for filename in filenames
                    )
                    
                    backup_info['directories'].append({
                        'path': directory,
                        'files': file_count,
                        'size': dir_size
                    })
                    backup_info['total_files'] += file_count
                    backup_info['total_size'] += dir_size
                    
                    logger.info(f"Backed up directory {directory}: {file_count} files, {dir_size} bytes")
            
            # Create backup archive
            archive_path = await self._create_encrypted_archive(temp_dir, backup_name)
            
            # Clean up temporary directory
            shutil.rmtree(temp_dir)
            
            # Save backup metadata
            metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(backup_info, f, indent=2)
            
            logger.info(f"Files backup created: {archive_path}")
            
            return {
                'success': True,
                'backup_name': backup_name,
                'archive_path': str(archive_path),
                'metadata': backup_info
            }
            
        except Exception as e:
            logger.error(f"Files backup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def create_configuration_backup(self) -> Dict[str, Any]:
        """Create encrypted backup of configuration files"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"config_backup_{timestamp}"
            
            # Create temporary directory for backup
            temp_dir = self.backup_dir / "temp" / backup_name
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            backup_info = {
                'type': 'configuration',
                'timestamp': timestamp,
                'configs': []
            }
            
            # Configuration files to backup
            config_files = [
                '.env',
                'docker-compose.yml',
                'backend/requirements.txt',
                'backend/alembic.ini',
                'frontend/package.json'
            ]
            
            for config_file in config_files:
                if os.path.exists(config_file):
                    # Copy config file
                    dest_file = temp_dir / os.path.basename(config_file)
                    shutil.copy2(config_file, dest_file)
                    
                    backup_info['configs'].append({
                        'file': config_file,
                        'size': os.path.getsize(config_file)
                    })
                    
                    logger.info(f"Backed up config file: {config_file}")
            
            # Backup environment-specific settings
            env_settings = {
                'ENVIRONMENT': settings.ENVIRONMENT,
                'APP_NAME': settings.APP_NAME,
                'VERSION': settings.VERSION,
                'DATABASE_URL': settings.DATABASE_URL.replace(
                    settings.DATABASE_URL.split('@')[0].split('://')[-1], 
                    '***'
                ) if '@' in settings.DATABASE_URL else 'configured',
                'REDIS_URL': 'configured' if settings.REDIS_URL else 'not configured'
            }
            
            env_file = temp_dir / "environment_settings.json"
            with open(env_file, 'w') as f:
                json.dump(env_settings, f, indent=2)
            
            backup_info['configs'].append({
                'file': 'environment_settings.json',
                'size': os.path.getsize(env_file)
            })
            
            # Create backup archive
            archive_path = await self._create_encrypted_archive(temp_dir, backup_name)
            
            # Clean up temporary directory
            shutil.rmtree(temp_dir)
            
            # Save backup metadata
            metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
            with open(metadata_path, 'w') as f:
                json.dump(backup_info, f, indent=2)
            
            logger.info(f"Configuration backup created: {archive_path}")
            
            return {
                'success': True,
                'backup_name': backup_name,
                'archive_path': str(archive_path),
                'metadata': backup_info
            }
            
        except Exception as e:
            logger.error(f"Configuration backup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _create_encrypted_archive(self, source_dir: Path, backup_name: str) -> Path:
        """Create encrypted and compressed archive"""
        try:
            # Create tar.gz archive
            archive_path = self.backup_dir / f"{backup_name}.tar.gz"
            
            with tarfile.open(archive_path, 'w:gz', compresslevel=self.compression_level) as tar:
                tar.add(source_dir, arcname=backup_name)
            
            # Encrypt the archive if encryption key is available
            if self.backup_encryption_key:
                encrypted_path = self.backup_dir / f"{backup_name}.encrypted"
                
                # Read and encrypt archive
                with open(archive_path, 'rb') as f:
                    archive_data = f.read()
                
                encrypted_data = encryption_service.encrypt_data(
                    archive_data, 
                    self.backup_encryption_key
                )
                
                # Write encrypted data
                with open(encrypted_path, 'w') as f:
                    f.write(encrypted_data)
                
                # Remove unencrypted archive
                os.remove(archive_path)
                
                logger.info(f"Created encrypted archive: {encrypted_path}")
                return encrypted_path
            else:
                logger.warning("No encryption key available, archive not encrypted")
                return archive_path
                
        except Exception as e:
            logger.error(f"Failed to create encrypted archive: {e}")
            raise
    
    async def restore_backup(self, backup_name: str, restore_type: str = "full") -> Dict[str, Any]:
        """Restore from encrypted backup"""
        try:
            # Find backup files
            encrypted_path = self.backup_dir / f"{backup_name}.encrypted"
            metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
            
            if not encrypted_path.exists():
                # Try unencrypted archive
                archive_path = self.backup_dir / f"{backup_name}.tar.gz"
                if not archive_path.exists():
                    return {
                        'success': False,
                        'error': f"Backup not found: {backup_name}"
                    }
                encrypted_path = archive_path
            
            if not metadata_path.exists():
                return {
                    'success': False,
                    'error': f"Backup metadata not found: {backup_name}"
                }
            
            # Load metadata
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
            
            # Create temporary restore directory
            restore_dir = self.backup_dir / "restore" / backup_name
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            # Decrypt and extract archive
            if encrypted_path.suffix == '.encrypted':
                # Decrypt archive
                with open(encrypted_path, 'r') as f:
                    encrypted_data = f.read()
                
                decrypted_data = encryption_service.decrypt_data(
                    encrypted_data, 
                    self.backup_encryption_key
                )
                
                # Write temporary archive
                temp_archive = restore_dir / "temp.tar.gz"
                with open(temp_archive, 'wb') as f:
                    f.write(decrypted_data.encode() if isinstance(decrypted_data, str) else decrypted_data)
                
                # Extract archive
                with tarfile.open(temp_archive, 'r:gz') as tar:
                    tar.extractall(restore_dir)
                
                # Remove temporary archive
                os.remove(temp_archive)
            else:
                # Extract unencrypted archive
                with tarfile.open(encrypted_path, 'r:gz') as tar:
                    tar.extractall(restore_dir)
            
            logger.info(f"Backup restored to: {restore_dir}")
            
            return {
                'success': True,
                'restore_path': str(restore_dir),
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Backup restore failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def list_backups(self) -> List[Dict[str, Any]]:
        """List available backups"""
        try:
            backups = []
            
            # Find all backup files
            for metadata_file in self.backup_dir.glob("*.metadata.json"):
                backup_name = metadata_file.stem.replace('.metadata', '')
                
                # Load metadata
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                # Check for archive file
                encrypted_path = self.backup_dir / f"{backup_name}.encrypted"
                archive_path = self.backup_dir / f"{backup_name}.tar.gz"
                
                if encrypted_path.exists():
                    archive_file = encrypted_path
                    encrypted = True
                elif archive_path.exists():
                    archive_file = archive_path
                    encrypted = False
                else:
                    continue  # Skip if no archive found
                
                # Get file size
                file_size = os.path.getsize(archive_file)
                
                backups.append({
                    'name': backup_name,
                    'type': metadata.get('type', 'unknown'),
                    'timestamp': metadata.get('timestamp'),
                    'size': file_size,
                    'encrypted': encrypted,
                    'metadata': metadata
                })
            
            # Sort by timestamp (newest first)
            backups.sort(key=lambda x: x['timestamp'], reverse=True)
            
            return backups
            
        except Exception as e:
            logger.error(f"Failed to list backups: {e}")
            return []
    
    async def cleanup_old_backups(self) -> Dict[str, Any]:
        """Clean up old backups based on retention policy"""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.retention_days)
            deleted_backups = []
            
            backups = await self.list_backups()
            
            for backup in backups:
                backup_date = datetime.strptime(backup['timestamp'], "%Y%m%d_%H%M%S")
                
                if backup_date < cutoff_date:
                    # Delete backup files
                    backup_name = backup['name']
                    
                    # Delete archive
                    encrypted_path = self.backup_dir / f"{backup_name}.encrypted"
                    archive_path = self.backup_dir / f"{backup_name}.tar.gz"
                    
                    if encrypted_path.exists():
                        os.remove(encrypted_path)
                    if archive_path.exists():
                        os.remove(archive_path)
                    
                    # Delete metadata
                    metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
                    if metadata_path.exists():
                        os.remove(metadata_path)
                    
                    deleted_backups.append(backup_name)
                    logger.info(f"Deleted old backup: {backup_name}")
            
            return {
                'success': True,
                'deleted_count': len(deleted_backups),
                'deleted_backups': deleted_backups
            }
            
        except Exception as e:
            logger.error(f"Backup cleanup failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def verify_backup_integrity(self, backup_name: str) -> Dict[str, Any]:
        """Verify backup integrity"""
        try:
            # Find backup files
            encrypted_path = self.backup_dir / f"{backup_name}.encrypted"
            archive_path = self.backup_dir / f"{backup_name}.tar.gz"
            metadata_path = self.backup_dir / f"{backup_name}.metadata.json"
            
            verification_result = {
                'backup_name': backup_name,
                'files_exist': {},
                'readable': False,
                'metadata_valid': False,
                'integrity_ok': False
            }
            
            # Check file existence
            verification_result['files_exist']['encrypted'] = encrypted_path.exists()
            verification_result['files_exist']['archive'] = archive_path.exists()
            verification_result['files_exist']['metadata'] = metadata_path.exists()
            
            if not any(verification_result['files_exist'].values()):
                return verification_result
            
            # Verify metadata
            if metadata_path.exists():
                try:
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    verification_result['metadata_valid'] = True
                    verification_result['metadata'] = metadata
                except Exception as e:
                    verification_result['metadata_error'] = str(e)
            
            # Try to read archive
            archive_file = encrypted_path if encrypted_path.exists() else archive_path
            
            try:
                if encrypted_path.exists() and self.backup_encryption_key:
                    # Try to decrypt
                    with open(encrypted_path, 'r') as f:
                        encrypted_data = f.read()
                    
                    decrypted_data = encryption_service.decrypt_data(
                        encrypted_data, 
                        self.backup_encryption_key
                    )
                    verification_result['readable'] = True
                    verification_result['encrypted'] = True
                
                elif archive_path.exists():
                    # Try to read tar file
                    with tarfile.open(archive_path, 'r:gz') as tar:
                        tar.getnames()  # This will fail if archive is corrupted
                    verification_result['readable'] = True
                    verification_result['encrypted'] = False
                
                verification_result['integrity_ok'] = verification_result['readable']
                
            except Exception as e:
                verification_result['read_error'] = str(e)
            
            return verification_result
            
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return {
                'backup_name': backup_name,
                'error': str(e),
                'integrity_ok': False
            }


# Global backup service instance
backup_service = BackupService()


# Utility functions for scheduled backups
async def create_scheduled_backup(backup_type: str = "full") -> Dict[str, Any]:
    """Create scheduled backup"""
    try:
        if backup_type == "database":
            async with get_db() as db:
                return await backup_service.create_database_backup(db)
        
        elif backup_type == "files":
            directories = [
                "uploads",
                "backend/app",
                "frontend/src"
            ]
            return await backup_service.create_files_backup(directories)
        
        elif backup_type == "configuration":
            return await backup_service.create_configuration_backup()
        
        elif backup_type == "full":
            # Create all backup types
            results = {}
            
            # Database backup
            async with get_db() as db:
                results['database'] = await backup_service.create_database_backup(db)
            
            # Files backup
            directories = ["uploads", "backend/app", "frontend/src"]
            results['files'] = await backup_service.create_files_backup(directories)
            
            # Configuration backup
            results['configuration'] = await backup_service.create_configuration_backup()
            
            return {
                'success': all(r.get('success', False) for r in results.values()),
                'results': results
            }
        
        else:
            return {
                'success': False,
                'error': f"Unknown backup type: {backup_type}"
            }
            
    except Exception as e:
        logger.error(f"Scheduled backup failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }