#!/usr/bin/env python3
"""
QuantumBeam Configuration Manager
Centralized configuration management with validation, versioning, and environment-specific settings.
"""

import os
import sys
import json
import yaml
import base64
import hashlib
import logging
import argparse
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from cryptography.fernet import Fernet
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class EnvironmentConfig:
    """Configuration data class for environments."""
    name: str
    region: str
    environment_type: str
    database_config: Dict[str, Any]
    redis_config: Dict[str, Any]
    monitoring_config: Dict[str, Any]
    security_config: Dict[str, Any]
    deployment_config: Dict[str, Any]
    feature_flags: Dict[str, bool]
    custom_settings: Dict[str, Any]

class ConfigEncryption:
    """Handles encryption and decryption of sensitive configuration values."""

    def __init__(self, key: Optional[str] = None):
        """Initialize encryption with a key or generate one."""
        if key:
            self.key = key.encode()
        else:
            self.key = Fernet.generate_key()
        self.cipher = Fernet(self.key)

    def encrypt(self, value: str) -> str:
        """Encrypt a sensitive value."""
        return self.cipher.encrypt(value.encode()).decode()

    def decrypt(self, encrypted_value: str) -> str:
        """Decrypt an encrypted value."""
        return self.cipher.decrypt(encrypted_value.encode()).decode()

    def get_key(self) -> str:
        """Get the encryption key."""
        return self.key.decode()

class AWSSecretsManager:
    """Manages configuration secrets using AWS Secrets Manager."""

    def __init__(self, region: str = 'us-east-1'):
        """Initialize AWS Secrets Manager client."""
        self.client = boto3.client('secretsmanager', region_name=region)
        self.region = region

    def store_secret(self, secret_name: str, secret_value: Dict[str, Any],
                    description: str = None, tags: List[Dict[str, str]] = None) -> bool:
        """Store a secret in AWS Secrets Manager."""
        try:
            secret_value_str = json.dumps(secret_value)

            response = self.client.create_secret(
                Name=secret_name,
                Description=description or f"Secret for {secret_name}",
                SecretString=secret_value_str,
                Tags=tags or []
            )
            logger.info(f"Secret stored successfully: {secret_name}")
            return True
        except self.client.exceptions.ResourceExistsException:
            # Update existing secret
            try:
                response = self.client.update_secret(
                    SecretId=secret_name,
                    SecretString=secret_value_str,
                    Description=description or f"Secret for {secret_name}"
                )
                logger.info(f"Secret updated successfully: {secret_name}")
                return True
            except ClientError as e:
                logger.error(f"Failed to update secret {secret_name}: {e}")
                return False
        except ClientError as e:
            logger.error(f"Failed to store secret {secret_name}: {e}")
            return False

    def get_secret(self, secret_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve a secret from AWS Secrets Manager."""
        try:
            response = self.client.get_secret_value(SecretId=secret_name)
            secret_value = json.loads(response['SecretString'])
            logger.info(f"Secret retrieved successfully: {secret_name}")
            return secret_value
        except ClientError as e:
            logger.error(f"Failed to retrieve secret {secret_name}: {e}")
            return None

    def delete_secret(self, secret_name: str, force_delete: bool = False) -> bool:
        """Delete a secret from AWS Secrets Manager."""
        try:
            if force_delete:
                response = self.client.delete_secret(
                    SecretId=secret_name,
                    ForceDeleteWithoutRecovery=True
                )
            else:
                response = self.client.delete_secret(SecretId=secret_name)

            logger.info(f"Secret deleted successfully: {secret_name}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete secret {secret_name}: {e}")
            return False

class ConfigValidator:
    """Validates configuration values and schemas."""

    @staticmethod
    def validate_environment_config(config: Dict[str, Any]) -> bool:
        """Validate environment configuration."""
        required_fields = ['name', 'region', 'environment_type']

        for field in required_fields:
            if field not in config:
                logger.error(f"Missing required field: {field}")
                return False

        # Validate environment type
        valid_env_types = ['development', 'staging', 'production']
        if config['environment_type'] not in valid_env_types:
            logger.error(f"Invalid environment type: {config['environment_type']}")
            return False

        # Validate AWS region
        valid_regions = [
            'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
            'eu-west-1', 'eu-west-2', 'eu-central-1'
        ]
        if config['region'] not in valid_regions:
            logger.error(f"Invalid AWS region: {config['region']}")
            return False

        return True

    @staticmethod
    def validate_database_config(config: Dict[str, Any]) -> bool:
        """Validate database configuration."""
        required_fields = ['host', 'port', 'database', 'username', 'password']

        for field in required_fields:
            if field not in config:
                logger.error(f"Missing required database field: {field}")
                return False

        # Validate port range
        try:
            port = int(config['port'])
            if not (1 <= port <= 65535):
                logger.error(f"Invalid database port: {port}")
                return False
        except ValueError:
            logger.error(f"Invalid database port format: {config['port']}")
            return False

        return True

    @staticmethod
    def validate_redis_config(config: Dict[str, Any]) -> bool:
        """Validate Redis configuration."""
        required_fields = ['host', 'port']

        for field in required_fields:
            if field not in config:
                logger.error(f"Missing required Redis field: {field}")
                return False

        # Validate port range
        try:
            port = int(config['port'])
            if not (1 <= port <= 65535):
                logger.error(f"Invalid Redis port: {port}")
                return False
        except ValueError:
            logger.error(f"Invalid Redis port format: {config['port']}")
            return False

        return True

    @staticmethod
    def validate_security_config(config: Dict[str, Any]) -> bool:
        """Validate security configuration."""
        required_fields = ['jwt_secret', 'encryption_key']

        for field in required_fields:
            if field not in config:
                logger.error(f"Missing required security field: {field}")
                return False

        # Validate JWT secret length (should be at least 32 characters)
        if len(config['jwt_secret']) < 32:
            logger.error("JWT secret must be at least 32 characters long")
            return False

        return True

class ConfigVersioning:
    """Manages configuration versioning and change tracking."""

    def __init__(self, storage_path: str = "./config/versions"):
        """Initialize configuration versioning."""
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def save_version(self, environment: str, config: Dict[str, Any],
                    comment: str = None, author: str = None) -> str:
        """Save a new version of configuration."""
        version_id = f"{environment}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        version_data = {
            'version_id': version_id,
            'environment': environment,
            'config': config,
            'comment': comment,
            'author': author or 'system',
            'timestamp': datetime.now().isoformat(),
            'checksum': self._calculate_checksum(config)
        }

        version_file = self.storage_path / f"{version_id}.json"
        with open(version_file, 'w') as f:
            json.dump(version_data, f, indent=2)

        logger.info(f"Configuration version saved: {version_id}")
        return version_id

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a specific configuration version."""
        version_file = self.storage_path / f"{version_id}.json"

        if version_file.exists():
            with open(version_file, 'r') as f:
                return json.load(f)

        logger.error(f"Version not found: {version_id}")
        return None

    def list_versions(self, environment: str = None) -> List[Dict[str, Any]]:
        """List all configuration versions, optionally filtered by environment."""
        versions = []

        for version_file in self.storage_path.glob("*.json"):
            with open(version_file, 'r') as f:
                version_data = json.load(f)

            if environment is None or version_data['environment'] == environment:
                versions.append(version_data)

        # Sort by timestamp (newest first)
        versions.sort(key=lambda x: x['timestamp'], reverse=True)
        return versions

    def rollback(self, environment: str, version_id: str) -> bool:
        """Rollback to a specific configuration version."""
        version_data = self.get_version(version_id)
        if not version_data:
            logger.error(f"Cannot rollback: Version {version_id} not found")
            return False

        # Create a new version with the rollback
        self.save_version(
            environment=environment,
            config=version_data['config'],
            comment=f"Rollback to version {version_id}",
            author="system"
        )

        logger.info(f"Rolled back {environment} to version {version_id}")
        return True

    def _calculate_checksum(self, config: Dict[str, Any]) -> str:
        """Calculate checksum of configuration for integrity verification."""
        config_str = json.dumps(config, sort_keys=True)
        return hashlib.sha256(config_str.encode()).hexdigest()

class ConfigManager:
    """Main configuration manager class."""

    def __init__(self, environment: str, region: str = 'us-east-1'):
        """Initialize configuration manager."""
        self.environment = environment
        self.region = region
        self.encryption = ConfigEncryption()
        self.secrets_manager = AWSSecretsManager(region)
        self.validator = ConfigValidator()
        self.versioning = ConfigVersioning()

        # Load current configuration
        self.config = self._load_config()

    def _load_config(self) -> EnvironmentConfig:
        """Load configuration for the specified environment."""
        config_file = Path(f"./config/{self.environment}.yaml")

        if config_file.exists():
            with open(config_file, 'r') as f:
                config_data = yaml.safe_load(f)

            # Decrypt sensitive values
            if 'security_config' in config_data:
                for key, value in config_data['security_config'].items():
                    if isinstance(value, str) and value.startswith('encrypted:'):
                        config_data['security_config'][key] = self.encryption.decrypt(value[10:])

            return EnvironmentConfig(**config_data)
        else:
            logger.info(f"Configuration file not found for {self.environment}, creating default")
            return self._create_default_config()

    def _create_default_config(self) -> EnvironmentConfig:
        """Create a default configuration for the environment."""
        return EnvironmentConfig(
            name=self.environment,
            region=self.region,
            environment_type=self.environment,
            database_config={
                'host': f'db.{self.environment}.quantumbeam.io',
                'port': 5432,
                'database': 'quantumbeam',
                'username': 'quantumbeam_user',
                'password': self.encryption.encrypt('temporary_password'),
                'max_connections': 100,
                'timeout': 30
            },
            redis_config={
                'host': f'redis.{self.environment}.quantumbeam.io',
                'port': 6379,
                'db': 0,
                'auth_token': self.encryption.encrypt('temporary_auth_token'),
                'timeout': 5
            },
            monitoring_config={
                'metrics_enabled': True,
                'tracing_enabled': True,
                'logging_level': 'INFO',
                'metrics_port': 9090,
                'health_check_interval': 30
            },
            security_config={
                'jwt_secret': self.encryption.encrypt('temporary_jwt_secret'),
                'encryption_key': self.encryption.get_key(),
                'ssl_enabled': True,
                'cors_enabled': True,
                'rate_limit_enabled': True,
                'rate_limit_requests': 1000,
                'rate_limit_window': 60
            },
            deployment_config={
                'replica_count': 3,
                'min_replicas': 2,
                'max_replicas': 10,
                'resource_requests': {
                    'cpu': '100m',
                    'memory': '256Mi'
                },
                'resource_limits': {
                    'cpu': '500m',
                    'memory': '512Mi'
                }
            },
            feature_flags={
                'new_ui_enabled': False,
                'experimental_features': False,
                'advanced_analytics': True,
                'real_time_processing': True
            },
            custom_settings={
                'cache_ttl': 3600,
                'session_timeout': 1800,
                'batch_size': 100,
                'worker_threads': 4
            }
        )

    def save_config(self, comment: str = None, author: str = None) -> bool:
        """Save current configuration."""
        # Validate configuration
        config_dict = asdict(self.config)

        if not self.validator.validate_environment_config(config_dict):
            return False

        if not self.validator.validate_database_config(self.config.database_config):
            return False

        if not self.validator.validate_redis_config(self.config.redis_config):
            return False

        if not self.validator.validate_security_config(self.config.security_config):
            return False

        # Encrypt sensitive values before saving
        if 'security_config' in config_dict:
            for key, value in config_dict['security_config'].items():
                if isinstance(value, str) and not value.startswith('encrypted:'):
                    config_dict['security_config'][key] = f"encrypted:{self.encryption.encrypt(value)}"

        # Save to file
        config_file = Path(f"./config/{self.environment}.yaml")
        with open(config_file, 'w') as f:
            yaml.dump(config_dict, f, default_flow_style=False)

        # Save version
        self.versioning.save_version(
            environment=self.environment,
            config=config_dict,
            comment=comment,
            author=author
        )

        # Store sensitive values in AWS Secrets Manager
        self._store_secrets()

        logger.info(f"Configuration saved for environment: {self.environment}")
        return True

    def _store_secrets(self) -> bool:
        """Store sensitive configuration values in AWS Secrets Manager."""
        secret_name = f"quantumbeam/{self.environment}/config"

        # Prepare secret data
        secret_data = {
            'database_password': self.encryption.decrypt(self.config.database_config['password']),
            'redis_auth_token': self.encryption.decrypt(self.config.redis_config['auth_token']),
            'jwt_secret': self.encryption.decrypt(self.config.security_config['jwt_secret']),
            'encryption_key': self.config.security_config['encryption_key']
        }

        tags = [
            {'Key': 'Environment', 'Value': self.environment},
            {'Key': 'Application', 'Value': 'QuantumBeam'},
            {'Key': 'ManagedBy', 'Value': 'ConfigManager'}
        ]

        return self.secrets_manager.store_secret(
            secret_name=secret_name,
            secret_value=secret_data,
            description=f"Configuration secrets for {self.environment} environment",
            tags=tags
        )

    def get_config_value(self, key_path: str) -> Any:
        """Get a configuration value using dot notation."""
        keys = key_path.split('.')
        value = self.config

        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                logger.error(f"Configuration key not found: {key_path}")
                return None

        return value

    def set_config_value(self, key_path: str, value: Any, encrypt: bool = False) -> bool:
        """Set a configuration value using dot notation."""
        keys = key_path.split('.')
        config_dict = asdict(self.config)

        # Navigate to the parent of the target key
        current = config_dict
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]

        # Set the value
        final_key = keys[-1]
        if encrypt and isinstance(value, str):
            current[final_key] = self.encryption.encrypt(value)
        else:
            current[final_key] = value

        # Update the config object
        self.config = EnvironmentConfig(**config_dict)

        logger.info(f"Configuration value set: {key_path}")
        return True

    def export_config(self, format: str = 'yaml', include_secrets: bool = False) -> str:
        """Export configuration in specified format."""
        config_dict = asdict(self.config)

        if not include_secrets:
            # Mask sensitive values
            config_dict['database_config']['password'] = '*****'
            config_dict['redis_config']['auth_token'] = '*****'
            config_dict['security_config']['jwt_secret'] = '*****'
            config_dict['security_config']['encryption_key'] = '*****'

        if format.lower() == 'yaml':
            return yaml.dump(config_dict, default_flow_style=False)
        elif format.lower() == 'json':
            return json.dumps(config_dict, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def import_config(self, config_data: str, format: str = 'yaml') -> bool:
        """Import configuration from specified format."""
        try:
            if format.lower() == 'yaml':
                config_dict = yaml.safe_load(config_data)
            elif format.lower() == 'json':
                config_dict = json.loads(config_data)
            else:
                raise ValueError(f"Unsupported format: {format}")

            self.config = EnvironmentConfig(**config_dict)
            logger.info("Configuration imported successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to import configuration: {e}")
            return False

    def compare_versions(self, version1: str, version2: str) -> Dict[str, Any]:
        """Compare two configuration versions."""
        v1 = self.versioning.get_version(version1)
        v2 = self.versioning.get_version(version2)

        if not v1 or not v2:
            return {'error': 'One or both versions not found'}

        # Compare configurations
        changes = {
            'added': {},
            'removed': {},
            'modified': {},
            'unchanged': {}
        }

        # Simple comparison logic (can be enhanced)
        config1 = v1['config']
        config2 = v2['config']

        all_keys = set(config1.keys()) | set(config2.keys())

        for key in all_keys:
            if key not in config1:
                changes['added'][key] = config2[key]
            elif key not in config2:
                changes['removed'][key] = config1[key]
            elif config1[key] != config2[key]:
                changes['modified'][key] = {
                    'old': config1[key],
                    'new': config2[key]
                }
            else:
                changes['unchanged'][key] = config1[key]

        return changes

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Configuration Manager')
    parser.add_argument('environment', help='Environment to manage (development/staging/production)')
    parser.add_argument('action', choices=[
        'show', 'set', 'save', 'export', 'import', 'versions', 'compare', 'rollback'
    ], help='Action to perform')
    parser.add_argument('--key', help='Configuration key (for set action)')
    parser.add_argument('--value', help='Configuration value (for set action)')
    parser.add_argument('--encrypt', action='store_true', help='Encrypt the value (for set action)')
    parser.add_argument('--format', choices=['yaml', 'json'], default='yaml', help='Output format')
    parser.add_argument('--include-secrets', action='store_true', help='Include secrets in export')
    parser.add_argument('--file', help='File to import from/export to')
    parser.add_argument('--comment', help='Version comment')
    parser.add_argument('--author', help='Change author')
    parser.add_argument('--version1', help='First version to compare')
    parser.add_argument('--version2', help='Second version to compare')

    args = parser.parse_args()

    # Initialize config manager
    config_manager = ConfigManager(args.environment)

    try:
        if args.action == 'show':
            if args.key:
                value = config_manager.get_config_value(args.key)
                print(f"{args.key}: {value}")
            else:
                print(config_manager.export_config(args.format, args.include_secrets))

        elif args.action == 'set':
            if not args.key or not args.value:
                print("Error: --key and --value are required for set action")
                sys.exit(1)

            success = config_manager.set_config_value(args.key, args.value, args.encrypt)
            if success:
                print(f"Configuration updated: {args.key}")
            else:
                print("Failed to update configuration")
                sys.exit(1)

        elif args.action == 'save':
            success = config_manager.save_config(args.comment, args.author)
            if success:
                print("Configuration saved successfully")
            else:
                print("Failed to save configuration")
                sys.exit(1)

        elif args.action == 'export':
            exported = config_manager.export_config(args.format, args.include_secrets)
            if args.file:
                with open(args.file, 'w') as f:
                    f.write(exported)
                print(f"Configuration exported to {args.file}")
            else:
                print(exported)

        elif args.action == 'import':
            if not args.file:
                print("Error: --file is required for import action")
                sys.exit(1)

            with open(args.file, 'r') as f:
                config_data = f.read()

            success = config_manager.import_config(config_data, args.format)
            if success:
                print("Configuration imported successfully")
                print("Run 'config-manager.py <env> save' to persist changes")
            else:
                print("Failed to import configuration")
                sys.exit(1)

        elif args.action == 'versions':
            versions = config_manager.versioning.list_versions(args.environment)
            for version in versions:
                print(f"{version['version_id']} - {version['timestamp']}")
                if version['comment']:
                    print(f"  Comment: {version['comment']}")
                print(f"  Author: {version['author']}")
                print()

        elif args.action == 'compare':
            if not args.version1 or not args.version2:
                print("Error: --version1 and --version2 are required for compare action")
                sys.exit(1)

            changes = config_manager.compare_versions(args.version1, args.version2)
            print(json.dumps(changes, indent=2))

        elif args.action == 'rollback':
            if not args.version1:
                print("Error: --version1 is required for rollback action")
                sys.exit(1)

            success = config_manager.versioning.rollback(args.environment, args.version1)
            if success:
                print(f"Rolled back to version {args.version1}")
            else:
                print("Failed to rollback")
                sys.exit(1)

    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()