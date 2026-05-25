"""
Multi-Cloud Infrastructure Orchestration Service
Centralized management for AWS, Azure, GCP, and Cloudflare providers
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union, Type
from uuid import UUID, uuid4
from enum import Enum
import aiohttp
import boto3
from azure.identity import DefaultAzureCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.mgmt.compute import ComputeManagementClient
from azure.mgmt.storage import StorageManagementClient
from azure.mgmt.network import NetworkManagementClient
from google.cloud import compute_v1
from google.cloud import storage
from google.cloud import resourcemanager_v3
from google.auth import default as gcp_default
import yaml

from app.core.config import get_settings
from app.database import get_db_session
from app.models.multi_cloud import (
    MultiCloudProvider, CloudResource, CloudDeployment,
    CloudCostTracker, CloudSecurityPolicy
)

logger = logging.getLogger(__name__)

class CloudProviderType(str, Enum):
    """Supported cloud provider types"""
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"
    CLOUDFLARE = "cloudflare"

class ResourceType(str, Enum):
    """Supported resource types"""
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    DATABASE = "database"
    SERVERLESS = "serverless"
    CONTAINER = "container"
    DNS = "dns"
    CDN = "cdn"
    SECURITY = "security"
    MONITORING = "monitoring"

class DeploymentStatus(str, Enum):
    """Deployment status values"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"
    ROLLED_BACK = "rolled_back"
    CANCELLED = "cancelled"

class MultiCloudOrchestrationService:
    """Centralized multi-cloud infrastructure orchestration service"""

    def __init__(self):
        self.settings = get_settings()
        self.provider_clients: Dict[str, Any] = {}
        self.active_deployments: Dict[str, asyncio.Task] = {}
        self.resource_locks: Dict[str, asyncio.Lock] = {}

    async def initialize_provider(self, provider_id: str) -> bool:
        """
        Initialize connection to a cloud provider

        Args:
            provider_id: ID of the provider to initialize

        Returns:
            True if initialization successful, False otherwise
        """
        try:
            async with get_db_session() as db:
                provider = await db.get(MultiCloudProvider, provider_id)
                if not provider:
                    raise ValueError(f"Provider {provider_id} not found")

                if provider.provider_type == CloudProviderType.AWS:
                    return await self._init_aws_provider(provider)
                elif provider.provider_type == CloudProviderType.AZURE:
                    return await self._init_azure_provider(provider)
                elif provider.provider_type == CloudProviderType.GCP:
                    return await self._init_gcp_provider(provider)
                elif provider.provider_type == CloudProviderType.CLOUDFLARE:
                    return await self._init_cloudflare_provider(provider)
                else:
                    raise ValueError(f"Unsupported provider type: {provider.provider_type}")

        except Exception as e:
            logger.error(f"Failed to initialize provider {provider_id}: {str(e)}")
            return False

    async def _init_aws_provider(self, provider: MultiCloudProvider) -> bool:
        """Initialize AWS provider connection"""
        try:
            credentials = json.loads(provider.credentials)

            # Initialize AWS clients
            session = boto3.Session(
                aws_access_key_id=credentials['access_key_id'],
                aws_secret_access_key=credentials['secret_access_key'],
                region_name=credentials.get('region', 'us-east-1')
            )

            self.provider_clients[provider.id] = {
                'ec2': session.client('ec2'),
                's3': session.client('s3'),
                'rds': session.client('rds'),
                'lambda': session.client('lambda'),
                'cloudformation': session.client('cloudformation'),
                'cloudwatch': session.client('cloudwatch'),
                'iam': session.client('iam'),
                'route53': session.client('route53')
            }

            # Test connection
            ec2 = self.provider_clients[provider.id]['ec2']
            await asyncio.to_thread(ec2.describe_regions)

            logger.info(f"Successfully initialized AWS provider: {provider.name}")
            return True

        except Exception as e:
            logger.error(f"AWS initialization failed: {str(e)}")
            return False

    async def _init_azure_provider(self, provider: MultiCloudProvider) -> bool:
        """Initialize Azure provider connection"""
        try:
            credentials = json.loads(provider.credentials)

            # Initialize Azure credential
            azure_credential = DefaultAzureCredential()

            subscription_id = credentials['subscription_id']

            # Initialize Azure clients
            self.provider_clients[provider.id] = {
                'resource': ResourceManagementClient(azure_credential, subscription_id),
                'compute': ComputeManagementClient(azure_credential, subscription_id),
                'storage': StorageManagementClient(azure_credential, subscription_id),
                'network': NetworkManagementClient(azure_credential, subscription_id)
            }

            # Test connection
            resource_client = self.provider_clients[provider.id]['resource']
            resource_groups = list(resource_client.resource_groups.list())

            logger.info(f"Successfully initialized Azure provider: {provider.name}")
            return True

        except Exception as e:
            logger.error(f"Azure initialization failed: {str(e)}")
            return False

    async def _init_gcp_provider(self, provider: MultiCloudProvider) -> bool:
        """Initialize GCP provider connection"""
        try:
            credentials = json.loads(provider.credentials)

            # Set GCP credentials
            import os
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials['service_account_key_path']

            # Initialize GCP clients
            self.provider_clients[provider.id] = {
                'compute': compute_v1.InstancesClient(),
                'storage': storage.Client(project=credentials['project_id']),
                'resource_manager': resourcemanager_v3.ProjectsClient()
            }

            # Test connection
            compute_client = self.provider_clients[provider.id]['compute']
            await asyncio.to_thread(
                compute_client.aggregated_list,
                project=credentials['project_id']
            )

            logger.info(f"Successfully initialized GCP provider: {provider.name}")
            return True

        except Exception as e:
            logger.error(f"GCP initialization failed: {str(e)}")
            return False

    async def _init_cloudflare_provider(self, provider: MultiCloudProvider) -> bool:
        """Initialize Cloudflare provider connection"""
        try:
            credentials = json.loads(provider.credentials)

            # Initialize Cloudflare client
            self.provider_clients[provider.id] = {
                'api_token': credentials['api_token'],
                'email': credentials['email'],
                'account_id': credentials.get('account_id')
            }

            # Test connection
            api_token = credentials['api_token']
            headers = {
                'Authorization': f'Bearer {api_token}',
                'Content-Type': 'application/json'
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    'https://api.cloudflare.com/client/v4/user/tokens/verify',
                    headers=headers
                ) as response:
                    if response.status != 200:
                        raise Exception("Cloudflare authentication failed")

            logger.info(f"Successfully initialized Cloudflare provider: {provider.name}")
            return True

        except Exception as e:
            logger.error(f"Cloudflare initialization failed: {str(e)}")
            return False

    async def deploy_resource(
        self,
        deployment_id: str,
        provider_id: str,
        resource_config: Dict[str, Any],
        deployment_plan: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Deploy a cloud resource with orchestration

        Args:
            deployment_id: Unique deployment identifier
            provider_id: ID of the target provider
            resource_config: Resource configuration
            deployment_plan: Optional deployment plan for complex resources

        Returns:
            Deployment result with resource details
        """
        try:
            # Acquire resource lock
            lock_key = f"deploy_{provider_id}"
            if lock_key not in self.resource_locks:
                self.resource_locks[lock_key] = asyncio.Lock()

            async with self.resource_locks[lock_key]:
                # Update deployment status
                await self._update_deployment_status(deployment_id, DeploymentStatus.IN_PROGRESS)

                # Initialize provider if not already done
                if provider_id not in self.provider_clients:
                    if not await self.initialize_provider(provider_id):
                        raise Exception(f"Failed to initialize provider {provider_id}")

                # Get provider details
                async with get_db_session() as db:
                    provider = await db.get(MultiCloudProvider, provider_id)
                    if not provider:
                        raise ValueError(f"Provider {provider_id} not found")

                # Deploy based on provider type and resource type
                resource_type = resource_config.get('type')
                result = await self._deploy_by_provider(
                    provider.provider_type,
                    provider_id,
                    resource_config,
                    deployment_plan
                )

                # Create resource record
                resource = CloudResource(
                    id=str(uuid4()),
                    tenant_id=provider.tenant_id,
                    provider_id=provider_id,
                    deployment_id=deployment_id,
                    name=resource_config.get('name'),
                    type=resource_type,
                    provider_resource_id=result.get('resource_id'),
                    configuration=resource_config,
                    status='active',
                    metadata=result.get('metadata', {}),
                    created_at=datetime.now(timezone.utc),
                    provider_specific_data=result.get('provider_data', {})
                )

                async with get_db_session() as db:
                    db.add(resource)
                    await db.commit()

                # Update deployment status
                await self._update_deployment_status(deployment_id, DeploymentStatus.SUCCESS)

                logger.info(f"Successfully deployed resource {resource_config.get('name')} on {provider.provider_type}")
                return result

        except Exception as e:
            logger.error(f"Deployment failed: {str(e)}")
            await self._update_deployment_status(deployment_id, DeploymentStatus.FAILED, str(e))
            raise

    async def _deploy_by_provider(
        self,
        provider_type: str,
        provider_id: str,
        resource_config: Dict[str, Any],
        deployment_plan: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Deploy resource based on provider type"""

        if provider_type == CloudProviderType.AWS:
            return await self._deploy_aws_resource(provider_id, resource_config)
        elif provider_type == CloudProviderType.AZURE:
            return await self._deploy_azure_resource(provider_id, resource_config)
        elif provider_type == CloudProviderType.GCP:
            return await self._deploy_gcp_resource(provider_id, resource_config)
        elif provider_type == CloudProviderType.CLOUDFLARE:
            return await self._deploy_cloudflare_resource(provider_id, resource_config)
        else:
            raise ValueError(f"Unsupported provider type: {provider_type}")

    async def _deploy_aws_resource(self, provider_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS resource"""
        clients = self.provider_clients[provider_id]
        resource_type = config.get('type')

        if resource_type == ResourceType.COMPUTE:
            return await self._deploy_aws_ec2_instance(clients['ec2'], config)
        elif resource_type == ResourceType.STORAGE:
            return await self._deploy_aws_s3_bucket(clients['s3'], config)
        elif resource_type == ResourceType.DATABASE:
            return await self._deploy_aws_rds_instance(clients['rds'], config)
        elif resource_type == ResourceType.SERVERLESS:
            return await self._deploy_aws_lambda(clients['lambda'], config)
        elif resource_type == ResourceType.NETWORK:
            return await self._deploy_aws_vpc(clients['ec2'], config)
        elif resource_type == ResourceType.DNS:
            return await self._deploy_aws_route53_record(clients['route53'], config)
        else:
            raise ValueError(f"Unsupported AWS resource type: {resource_type}")

    async def _deploy_azure_resource(self, provider_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy Azure resource"""
        clients = self.provider_clients[provider_id]
        resource_type = config.get('type')

        if resource_type == ResourceType.COMPUTE:
            return await self._deploy_azure_vm(clients['compute'], config)
        elif resource_type == ResourceType.STORAGE:
            return await self._deploy_azure_storage(clients['storage'], config)
        elif resource_type == ResourceType.NETWORK:
            return await self._deploy_azure_vnet(clients['network'], config)
        else:
            raise ValueError(f"Unsupported Azure resource type: {resource_type}")

    async def _deploy_gcp_resource(self, provider_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy GCP resource"""
        clients = self.provider_clients[provider_id]
        resource_type = config.get('type')

        if resource_type == ResourceType.COMPUTE:
            return await self._deploy_gcp_vm(clients['compute'], config)
        elif resource_type == ResourceType.STORAGE:
            return await self._deploy_gcp_bucket(clients['storage'], config)
        else:
            raise ValueError(f"Unsupported GCP resource type: {resource_type}")

    async def _deploy_cloudflare_resource(self, provider_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy Cloudflare resource"""
        clients = self.provider_clients[provider_id]
        resource_type = config.get('type')

        # Import Cloudflare service for consistency
        from app.services.cloudflare_service import CloudflareService
        cf_service = CloudflareService()

        if resource_type == ResourceType.DNS:
            return await cf_service.create_dns_record(
                provider_id,
                config.get('zone_id'),
                config
            )
        elif resource_type == ResourceType.CDN:
            return await cf_service.create_zone(provider_id, config)
        elif resource_type == ResourceType.SERVERLESS:
            return await cf_service.deploy_worker(provider_id, config)
        elif resource_type == ResourceType.STORAGE:
            return await cf_service.create_r2_bucket(provider_id, config)
        else:
            raise ValueError(f"Unsupported Cloudflare resource type: {resource_type}")

    # AWS Resource Deployment Methods
    async def _deploy_aws_ec2_instance(self, ec2_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS EC2 instance"""
        instance_config = {
            'ImageId': config.get('image_id', 'ami-0c02fb55956c7d316'),
            'InstanceType': config.get('instance_type', 't3.micro'),
            'MinCount': 1,
            'MaxCount': 1,
            'TagSpecifications': [
                {
                    'ResourceType': 'instance',
                    'Tags': config.get('tags', [])
                }
            ]
        }

        if config.get('key_name'):
            instance_config['KeyName'] = config['key_name']

        if config.get('security_groups'):
            instance_config['SecurityGroups'] = config['security_groups']

        if config.get('user_data'):
            instance_config['UserData'] = config['user_data']

        response = await asyncio.to_thread(ec2_client.run_instances, **instance_config)
        instance_id = response['Instances'][0]['InstanceId']

        # Wait for instance to be running
        waiter = ec2_client.get_waiter('instance_running')
        await asyncio.to_thread(waiter.wait, InstanceIds=[instance_id])

        return {
            'resource_id': instance_id,
            'resource_type': ResourceType.COMPUTE,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'instance_id': instance_id,
                'instance_type': instance_config['InstanceType'],
                'image_id': instance_config['ImageId']
            }
        }

    async def _deploy_aws_s3_bucket(self, s3_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS S3 bucket"""
        bucket_name = config['name']

        # Create bucket
        await asyncio.to_thread(
            s3_client.create_bucket,
            Bucket=bucket_name,
            CreateBucketConfiguration={'LocationConstraint': config.get('region', 'us-east-1')}
        )

        # Configure bucket
        if config.get('versioning'):
            await asyncio.to_thread(
                s3_client.put_bucket_versioning,
                Bucket=bucket_name,
                VersioningConfiguration={'Status': 'Enabled'}
            )

        if config.get('encryption'):
            await asyncio.to_thread(
                s3_client.put_bucket_encryption,
                Bucket=bucket_name,
                ServerSideEncryptionConfiguration={
                    'Rules': [
                        {
                            'ApplyServerSideEncryptionByDefault': {
                                'SSEAlgorithm': 'AES256'
                            }
                        }
                    ]
                }
            )

        return {
            'resource_id': bucket_name,
            'resource_type': ResourceType.STORAGE,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'bucket_name': bucket_name,
                'region': config.get('region', 'us-east-1'),
                'versioning': config.get('versioning', False)
            }
        }

    async def _deploy_aws_rds_instance(self, rds_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS RDS instance"""
        db_config = {
            'DBInstanceIdentifier': config['name'],
            'DBInstanceClass': config.get('instance_class', 'db.t3.micro'),
            'Engine': config.get('engine', 'mysql'),
            'MasterUsername': config['username'],
            'MasterUserPassword': config['password'],
            'AllocatedStorage': config.get('allocated_storage', 20),
            'BackupRetentionPeriod': config.get('backup_retention', 7)
        }

        response = await asyncio.to_thread(rds_client.create_db_instance, **db_config)
        db_instance_id = response['DBInstance']['DBInstanceIdentifier']

        return {
            'resource_id': db_instance_id,
            'resource_type': ResourceType.DATABASE,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'db_instance_id': db_instance_id,
                'engine': db_config['Engine'],
                'instance_class': db_config['DBInstanceClass']
            }
        }

    async def _deploy_aws_lambda(self, lambda_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS Lambda function"""
        lambda_config = {
            'FunctionName': config['name'],
            'Runtime': config.get('runtime', 'python3.9'),
            'Role': config['role_arn'],
            'Handler': config.get('handler', 'lambda_function.lambda_handler'),
            'Code': {
                'ZipFile': config.get('code', b'def lambda_handler(event, context): return "Hello World"')
            }
        }

        if config.get('environment'):
            lambda_config['Environment'] = {'Variables': config['environment']}

        response = await asyncio.to_thread(lambda_client.create_function, **lambda_config)
        function_arn = response['FunctionArn']

        return {
            'resource_id': function_arn,
            'resource_type': ResourceType.SERVERLESS,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'function_name': config['name'],
                'runtime': lambda_config['Runtime'],
                'handler': lambda_config['Handler']
            }
        }

    async def _deploy_aws_vpc(self, ec2_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS VPC"""
        vpc_response = await asyncio.to_thread(
            ec2_client.create_vpc,
            CidrBlock=config.get('cidr_block', '10.0.0.0/16'),
            TagSpecifications=[
                {
                    'ResourceType': 'vpc',
                    'Tags': config.get('tags', [])
                }
            ]
        )

        vpc_id = vpc_response['Vpc']['VpcId']

        return {
            'resource_id': vpc_id,
            'resource_type': ResourceType.NETWORK,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'vpc_id': vpc_id,
                'cidr_block': config.get('cidr_block', '10.0.0.0/16')
            }
        }

    async def _deploy_aws_route53_record(self, route53_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy AWS Route53 DNS record"""
        record_config = {
            'HostedZoneId': config['hosted_zone_id'],
            'ChangeBatch': {
                'Changes': [
                    {
                        'Action': config.get('action', 'CREATE'),
                        'ResourceRecordSet': {
                            'Name': config['name'],
                            'Type': config['type'],
                            'TTL': config.get('ttl', 300),
                            'ResourceRecords': [
                                {'Value': config['value']}
                            ]
                        }
                    }
                ]
            }
        }

        response = await asyncio.to_thread(route53_client.change_resource_record_sets, **record_config)
        change_id = response['ChangeInfo']['Id']

        return {
            'resource_id': change_id,
            'resource_type': ResourceType.DNS,
            'provider': CloudProviderType.AWS,
            'metadata': {
                'record_name': config['name'],
                'record_type': config['type'],
                'record_value': config['value']
            }
        }

    # Azure Resource Deployment Methods
    async def _deploy_azure_vm(self, compute_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy Azure Virtual Machine"""
        # This is a simplified Azure VM deployment
        # In practice, this would involve more complex resource group and networking setup

        vm_name = config['name']
        resource_group = config['resource_group']

        vm_parameters = {
            'location': config.get('location', 'East US'),
            'hardware_profile': {
                'vm_size': config.get('vm_size', 'Standard_B1s')
            },
            'storage_profile': {
                'image_reference': {
                    'publisher': config.get('publisher', 'Canonical'),
                    'offer': config.get('offer', 'UbuntuServer'),
                    'sku': config.get('sku', '18.04-LTS'),
                    'version': 'latest'
                }
            },
            'os_profile': {
                'computer_name': vm_name,
                'admin_username': config.get('admin_username', 'azureuser'),
                'admin_password': config.get('admin_password')
            },
            'network_profile': {
                'network_interfaces': [{
                    'id': config.get('network_interface_id')
                }]
            }
        }

        # Azure operations would be synchronous in the SDK
        poller = compute_client.virtual_machines.begin_create_or_update(
            resource_group, vm_name, vm_parameters
        )
        vm_result = poller.result()

        return {
            'resource_id': vm_result.id,
            'resource_type': ResourceType.COMPUTE,
            'provider': CloudProviderType.AZURE,
            'metadata': {
                'vm_name': vm_name,
                'resource_group': resource_group,
                'vm_size': vm_parameters['hardware_profile']['vm_size']
            }
        }

    async def _deploy_azure_storage(self, storage_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy Azure Storage Account"""
        storage_name = config['name']
        resource_group = config['resource_group']

        storage_params = {
            'location': config.get('location', 'East US'),
            'sku': {'name': config.get('sku', 'Standard_LRS')},
            'kind': config.get('kind', 'StorageV2')
        }

        poller = storage_client.storage_accounts.begin_create(
            resource_group, storage_name, storage_params
        )
        storage_result = poller.result()

        return {
            'resource_id': storage_result.id,
            'resource_type': ResourceType.STORAGE,
            'provider': CloudProviderType.AZURE,
            'metadata': {
                'storage_name': storage_name,
                'resource_group': resource_group,
                'sku': storage_params['sku']['name']
            }
        }

    async def _deploy_azure_vnet(self, network_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy Azure Virtual Network"""
        vnet_name = config['name']
        resource_group = config['resource_group']

        vnet_params = {
            'location': config.get('location', 'East US'),
            'address_space': {
                'address_prefixes': [config.get('address_prefix', '10.0.0.0/16')]
            }
        }

        poller = network_client.virtual_networks.begin_create_or_update(
            resource_group, vnet_name, vnet_params
        )
        vnet_result = poller.result()

        return {
            'resource_id': vnet_result.id,
            'resource_type': ResourceType.NETWORK,
            'provider': CloudProviderType.AZURE,
            'metadata': {
                'vnet_name': vnet_name,
                'resource_group': resource_group,
                'address_prefix': config.get('address_prefix', '10.0.0.0/16')
            }
        }

    # GCP Resource Deployment Methods
    async def _deploy_gcp_vm(self, compute_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy GCP Compute Engine instance"""
        project_id = config['project_id']
        zone = config.get('zone', 'us-central1-a')
        instance_name = config['name']

        instance_config = {
            'name': instance_name,
            'machine_type': f"zones/{zone}/machineTypes/{config.get('machine_type', 'e2-micro')}",
            'disks': [
                {
                    'boot': True,
                    'auto_delete': True,
                    'initialize_params': {
                        'source_image': config.get('source_image', 'projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220101')
                    }
                }
            ],
            'network_interfaces': [
                {
                    'network': config.get('network', 'global/networks/default'),
                    'access_configs': [{'type': 'ONE_TO_ONE_NAT', 'name': 'External NAT'}]
                }
            ]
        }

        # GCP operations would be synchronous
        operation = compute_client.insert(
            project=project_id,
            zone=zone,
            instance_resource=instance_config
        )

        # Wait for operation to complete
        operation.result()

        return {
            'resource_id': instance_name,
            'resource_type': ResourceType.COMPUTE,
            'provider': CloudProviderType.GCP,
            'metadata': {
                'instance_name': instance_name,
                'project_id': project_id,
                'zone': zone,
                'machine_type': instance_config['machine_type']
            }
        }

    async def _deploy_gcp_bucket(self, storage_client, config: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy GCP Cloud Storage bucket"""
        bucket_name = config['name']

        bucket = storage_client.bucket(bucket_name)
        bucket.create(
            location=config.get('location', 'US'),
            storage_class=config.get('storage_class', 'STANDARD')
        )

        # Configure lifecycle rules if provided
        if config.get('lifecycle_rules'):
            bucket.add_lifecycle_rules(config['lifecycle_rules'])

        return {
            'resource_id': bucket_name,
            'resource_type': ResourceType.STORAGE,
            'provider': CloudProviderType.GCP,
            'metadata': {
                'bucket_name': bucket_name,
                'location': config.get('location', 'US'),
                'storage_class': config.get('storage_class', 'STANDARD')
            }
        }

    async def _update_deployment_status(
        self,
        deployment_id: str,
        status: DeploymentStatus,
        error_message: Optional[str] = None
    ) -> None:
        """Update deployment status in database"""
        try:
            async with get_db_session() as db:
                deployment = await db.get(CloudDeployment, deployment_id)
                if deployment:
                    deployment.status = status
                    deployment.updated_at = datetime.now(timezone.utc)
                    if error_message:
                        deployment.error_message = error_message
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to update deployment status: {str(e)}")

    async def list_resources(
        self,
        provider_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List cloud resources with filtering

        Args:
            provider_id: Filter by provider
            resource_type: Filter by resource type
            tenant_id: Filter by tenant

        Returns:
            List of resource information
        """
        try:
            async with get_db_session() as db:
                query = db.query(CloudResource)

                if provider_id:
                    query = query.filter(CloudResource.provider_id == provider_id)
                if resource_type:
                    query = query.filter(CloudResource.type == resource_type)
                if tenant_id:
                    query = query.filter(CloudResource.tenant_id == tenant_id)

                resources = await query.all()

                return [
                    {
                        'id': resource.id,
                        'name': resource.name,
                        'type': resource.type,
                        'provider_id': resource.provider_id,
                        'deployment_id': resource.deployment_id,
                        'status': resource.status,
                        'provider_resource_id': resource.provider_resource_id,
                        'configuration': resource.configuration,
                        'metadata': resource.metadata,
                        'created_at': resource.created_at,
                        'updated_at': resource.updated_at
                    }
                    for resource in resources
                ]
        except Exception as e:
            logger.error(f"Failed to list resources: {str(e)}")
            raise

    async def delete_resource(self, resource_id: str, force: bool = False) -> Dict[str, Any]:
        """
        Delete a cloud resource

        Args:
            resource_id: ID of the resource to delete
            force: Force deletion without confirmation

        Returns:
            Deletion result
        """
        try:
            async with get_db_session() as db:
                resource = await db.get(CloudResource, resource_id)
                if not resource:
                    raise ValueError(f"Resource {resource_id} not found")

                # Get provider client
                if resource.provider_id not in self.provider_clients:
                    if not await self.initialize_provider(resource.provider_id):
                        raise Exception(f"Failed to initialize provider {resource.provider_id}")

                # Delete based on provider and resource type
                result = await self._delete_resource_by_provider(resource)

                # Update resource status
                resource.status = 'deleted'
                resource.deleted_at = datetime.now(timezone.utc)
                await db.commit()

                logger.info(f"Successfully deleted resource {resource.name}")
                return result

        except Exception as e:
            logger.error(f"Failed to delete resource {resource_id}: {str(e)}")
            raise

    async def _delete_resource_by_provider(self, resource: CloudResource) -> Dict[str, Any]:
        """Delete resource based on provider type"""
        async with get_db_session() as db:
            provider = await db.get(MultiCloudProvider, resource.provider_id)

            if provider.provider_type == CloudProviderType.AWS:
                return await self._delete_aws_resource(resource)
            elif provider.provider_type == CloudProviderType.AZURE:
                return await self._delete_azure_resource(resource)
            elif provider.provider_type == CloudProviderType.GCP:
                return await self._delete_gcp_resource(resource)
            elif provider.provider_type == CloudProviderType.CLOUDFLARE:
                return await self._delete_cloudflare_resource(resource)
            else:
                raise ValueError(f"Unsupported provider type: {provider.provider_type}")

    async def _delete_aws_resource(self, resource: CloudResource) -> Dict[str, Any]:
        """Delete AWS resource"""
        clients = self.provider_clients[resource.provider_id]

        if resource.type == ResourceType.COMPUTE:
            await asyncio.to_thread(
                clients['ec2'].terminate_instances,
                InstanceIds=[resource.provider_resource_id]
            )
        elif resource.type == ResourceType.STORAGE:
            await asyncio.to_thread(
                clients['s3'].delete_bucket,
                Bucket=resource.provider_resource_id
            )
        elif resource.type == ResourceType.DATABASE:
            await asyncio.to_thread(
                clients['rds'].delete_db_instance,
                DBInstanceIdentifier=resource.provider_resource_id,
                SkipFinalSnapshot=True
            )
        elif resource.type == ResourceType.SERVERLESS:
            await asyncio.to_thread(
                clients['lambda'].delete_function,
                FunctionName=resource.name
            )
        elif resource.type == ResourceType.NETWORK:
            await asyncio.to_thread(
                clients['ec2'].delete_vpc,
                VpcId=resource.provider_resource_id
            )

        return {'status': 'deleted', 'resource_id': resource.provider_resource_id}

    async def _delete_azure_resource(self, resource: CloudResource) -> Dict[str, Any]:
        """Delete Azure resource"""
        clients = self.provider_clients[resource.provider_id]
        config = resource.configuration

        if resource.type == ResourceType.COMPUTE:
            compute_client = clients['compute']
            poller = compute_client.virtual_machines.begin_delete(
                config['resource_group'], resource.name
            )
            poller.result()
        elif resource.type == ResourceType.STORAGE:
            storage_client = clients['storage']
            poller = storage_client.storage_accounts.begin_delete(
                config['resource_group'], resource.name
            )
            poller.result()

        return {'status': 'deleted', 'resource_id': resource.provider_resource_id}

    async def _delete_gcp_resource(self, resource: CloudResource) -> Dict[str, Any]:
        """Delete GCP resource"""
        clients = self.provider_clients[resource.provider_id]
        config = resource.configuration

        if resource.type == ResourceType.COMPUTE:
            compute_client = clients['compute']
            operation = compute_client.delete(
                project=config['project_id'],
                zone=config.get('zone', 'us-central1-a'),
                instance=resource.provider_resource_id
            )
            operation.result()
        elif resource.type == ResourceType.STORAGE:
            storage_client = clients['storage']
            bucket = storage_client.bucket(resource.provider_resource_id)
            bucket.delete()

        return {'status': 'deleted', 'resource_id': resource.provider_resource_id}

    async def _delete_cloudflare_resource(self, resource: CloudResource) -> Dict[str, Any]:
        """Delete Cloudflare resource"""
        from app.services.cloudflare_service import CloudflareService
        cf_service = CloudflareService()

        config = resource.configuration

        if resource.type == ResourceType.DNS:
            await cf_service.delete_dns_record(
                resource.provider_id,
                config.get('zone_id'),
                resource.provider_resource_id
            )
        elif resource.type == ResourceType.CDN:
            await cf_service.delete_zone(resource.provider_id, resource.provider_resource_id)
        elif resource.type == ResourceType.SERVERLESS:
            await cf_service.delete_worker(resource.provider_id, resource.name)
        elif resource.type == ResourceType.STORAGE:
            await cf_service.delete_r2_bucket(resource.provider_id, resource.provider_resource_id)

        return {'status': 'deleted', 'resource_id': resource.provider_resource_id}

    async def get_resource_metrics(
        self,
        resource_id: str,
        time_range: str = "1h",
        metrics: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get metrics for a specific resource

        Args:
            resource_id: ID of the resource
            time_range: Time range for metrics (e.g., "1h", "24h", "7d")
            metrics: List of metrics to retrieve

        Returns:
            Resource metrics data
        """
        try:
            async with get_db_session() as db:
                resource = await db.get(CloudResource, resource_id)
                if not resource:
                    raise ValueError(f"Resource {resource_id} not found")

                # Get provider client
                if resource.provider_id not in self.provider_clients:
                    if not await self.initialize_provider(resource.provider_id):
                        raise Exception(f"Failed to initialize provider {resource.provider_id}")

                # Get metrics based on provider and resource type
                if metrics is None:
                    metrics = self._get_default_metrics(resource.type)

                return await self._collect_metrics(resource, metrics, time_range)

        except Exception as e:
            logger.error(f"Failed to get metrics for resource {resource_id}: {str(e)}")
            raise

    def _get_default_metrics(self, resource_type: str) -> List[str]:
        """Get default metrics for resource type"""
        metrics_map = {
            ResourceType.COMPUTE: ['cpu_utilization', 'memory_utilization', 'network_in', 'network_out'],
            ResourceType.STORAGE: ['bucket_size', 'object_count', 'request_count'],
            ResourceType.DATABASE: ['cpu_utilization', 'memory_utilization', 'connections', 'read_iops', 'write_iops'],
            ResourceType.SERVERLESS: ['invocations', 'duration', 'errors'],
            ResourceType.NETWORK: ['bandwidth_in', 'bandwidth_out', 'packet_count'],
            ResourceType.DNS: ['query_count', 'response_time']
        }
        return metrics_map.get(resource_type, ['availability'])

    async def _collect_metrics(
        self,
        resource: CloudResource,
        metrics: List[str],
        time_range: str
    ) -> Dict[str, Any]:
        """Collect metrics from provider"""
        async with get_db_session() as db:
            provider = await db.get(MultiCloudProvider, resource.provider_id)

            if provider.provider_type == CloudProviderType.AWS:
                return await self._collect_aws_metrics(resource, metrics, time_range)
            elif provider.provider_type == CloudProviderType.AZURE:
                return await self._collect_azure_metrics(resource, metrics, time_range)
            elif provider.provider_type == CloudProviderType.GCP:
                return await self._collect_gcp_metrics(resource, metrics, time_range)
            elif provider.provider_type == CloudProviderType.CLOUDFLARE:
                return await self._collect_cloudflare_metrics(resource, metrics, time_range)
            else:
                return {}

    async def _collect_aws_metrics(
        self,
        resource: CloudResource,
        metrics: List[str],
        time_range: str
    ) -> Dict[str, Any]:
        """Collect AWS CloudWatch metrics"""
        clients = self.provider_clients[resource.provider_id]
        cloudwatch = clients['cloudwatch']

        # Convert time range to timestamps
        end_time = datetime.now(timezone.utc)
        start_time = self._parse_time_range(time_range, end_time)

        metrics_data = {}

        for metric_name in metrics:
            try:
                if resource.type == ResourceType.COMPUTE:
                    namespace = 'AWS/EC2'
                    dimensions = [{'Name': 'InstanceId', 'Value': resource.provider_resource_id}]
                elif resource.type == ResourceType.DATABASE:
                    namespace = 'AWS/RDS'
                    dimensions = [{'Name': 'DBInstanceIdentifier', 'Value': resource.provider_resource_id}]
                else:
                    continue

                response = await asyncio.to_thread(
                    cloudwatch.get_metric_statistics,
                    Namespace=namespace,
                    MetricName=metric_name,
                    Dimensions=dimensions,
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=300,  # 5-minute periods
                    Statistics=['Average', 'Maximum', 'Minimum']
                )

                metrics_data[metric_name] = response['Datapoints']

            except Exception as e:
                logger.warning(f"Failed to collect AWS metric {metric_name}: {str(e)}")
                metrics_data[metric_name] = []

        return {
            'provider': 'aws',
            'resource_id': resource.id,
            'time_range': time_range,
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'metrics': metrics_data
        }

    async def _collect_azure_metrics(
        self,
        resource: CloudResource,
        metrics: List[str],
        time_range: str
    ) -> Dict[str, Any]:
        """Collect Azure Monitor metrics"""
        # Azure Monitor metrics collection would be implemented here
        # This would use azure.mgmt.monitor.MonitorManagementClient

        return {
            'provider': 'azure',
            'resource_id': resource.id,
            'time_range': time_range,
            'metrics': {}  # Placeholder
        }

    async def _collect_gcp_metrics(
        self,
        resource: CloudResource,
        metrics: List[str],
        time_range: str
    ) -> Dict[str, Any]:
        """Collect GCP Cloud Monitoring metrics"""
        # GCP Cloud Monitoring metrics collection would be implemented here
        # This would use google.cloud.monitoring_v3.MetricServiceClient

        return {
            'provider': 'gcp',
            'resource_id': resource.id,
            'time_range': time_range,
            'metrics': {}  # Placeholder
        }

    async def _collect_cloudflare_metrics(
        self,
        resource: CloudResource,
        metrics: List[str],
        time_range: str
    ) -> Dict[str, Any]:
        """Collect Cloudflare Analytics metrics"""
        # Use existing Cloudflare service for metrics
        from app.services.cloudflare_service import CloudflareService
        cf_service = CloudflareService()

        config = resource.configuration

        if resource.type == ResourceType.CDN:
            # Get zone analytics
            analytics = await cf_service.get_zone_analytics(
                resource.provider_id,
                config.get('zone_id'),
                time_range
            )
            return {
                'provider': 'cloudflare',
                'resource_id': resource.id,
                'time_range': time_range,
                'metrics': analytics
            }

        return {
            'provider': 'cloudflare',
            'resource_id': resource.id,
            'time_range': time_range,
            'metrics': {}
        }

    def _parse_time_range(self, time_range: str, end_time: datetime) -> datetime:
        """Parse time range string to start time"""
        if time_range.endswith('h'):
            hours = int(time_range[:-1])
            return end_time - timedelta(hours=hours)
        elif time_range.endswith('d'):
            days = int(time_range[:-1])
            return end_time - timedelta(days=days)
        elif time_range.endswith('m'):
            minutes = int(time_range[:-1])
            return end_time - timedelta(minutes=minutes)
        else:
            # Default to 1 hour
            return end_time - timedelta(hours=1)

    async def get_cost_tracking(
        self,
        tenant_id: Optional[str] = None,
        provider_id: Optional[str] = None,
        time_range: str = "30d"
    ) -> Dict[str, Any]:
        """
        Get cost tracking data for resources

        Args:
            tenant_id: Filter by tenant
            provider_id: Filter by provider
            time_range: Time range for cost data

        Returns:
            Cost tracking information
        """
        try:
            async with get_db_session() as db:
                query = db.query(CloudCostTracker)

                if tenant_id:
                    query = query.filter(CloudCostTracker.tenant_id == tenant_id)
                if provider_id:
                    query = query.filter(CloudCostTracker.provider_id == provider_id)

                # Parse time range
                end_date = datetime.now(timezone.utc).date()
                start_date = self._parse_date_range(time_range, end_date)

                query = query.filter(
                    CloudCostTracker.date >= start_date,
                    CloudCostTracker.date <= end_date
                )

                cost_data = await query.all()

                # Aggregate costs
                total_cost = sum(record.cost_amount for record in cost_data)
                costs_by_provider = {}
                costs_by_type = {}
                daily_costs = {}

                for record in cost_data:
                    # By provider
                    if record.provider_id not in costs_by_provider:
                        costs_by_provider[record.provider_id] = 0
                    costs_by_provider[record.provider_id] += record.cost_amount

                    # By type
                    if record.resource_type not in costs_by_type:
                        costs_by_type[record.resource_type] = 0
                    costs_by_type[record.resource_type] += record.cost_amount

                    # By day
                    date_str = record.date.isoformat()
                    if date_str not in daily_costs:
                        daily_costs[date_str] = 0
                    daily_costs[date_str] += record.cost_amount

                return {
                    'total_cost': total_cost,
                    'time_range': time_range,
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'costs_by_provider': costs_by_provider,
                    'costs_by_type': costs_by_type,
                    'daily_costs': daily_costs,
                    'currency': 'USD'
                }

        except Exception as e:
            logger.error(f"Failed to get cost tracking data: {str(e)}")
            raise

    def _parse_date_range(self, time_range: str, end_date: datetime.date) -> datetime.date:
        """Parse date range string to start date"""
        if time_range.endswith('d'):
            days = int(time_range[:-1])
            return end_date - timedelta(days=days)
        elif time_range.endswith('m'):
            months = int(time_range[:-1])
            # Approximate month calculation
            return end_date - timedelta(days=months * 30)
        else:
            # Default to 30 days
            return end_date - timedelta(days=30)

    async def optimize_resources(
        self,
        tenant_id: str,
        optimization_type: str = "cost"
    ) -> List[Dict[str, Any]]:
        """
        Analyze and provide optimization recommendations

        Args:
            tenant_id: Tenant to analyze
            optimization_type: Type of optimization (cost, performance, security)

        Returns:
            List of optimization recommendations
        """
        try:
            recommendations = []

            # Get all resources for tenant
            resources = await self.list_resources(tenant_id=tenant_id)

            for resource in resources:
                resource_recommendations = await self._analyze_resource_for_optimization(
                    resource, optimization_type
                )
                recommendations.extend(resource_recommendations)

            return recommendations

        except Exception as e:
            logger.error(f"Failed to generate optimization recommendations: {str(e)}")
            raise

    async def _analyze_resource_for_optimization(
        self,
        resource: Dict[str, Any],
        optimization_type: str
    ) -> List[Dict[str, Any]]:
        """Analyze individual resource for optimization opportunities"""
        recommendations = []

        if optimization_type == "cost":
            recommendations.extend(await self._analyze_cost_optimization(resource))
        elif optimization_type == "performance":
            recommendations.extend(await self._analyze_performance_optimization(resource))
        elif optimization_type == "security":
            recommendations.extend(await self._analyze_security_optimization(resource))

        return recommendations

    async def _analyze_cost_optimization(self, resource: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze resource for cost optimization opportunities"""
        recommendations = []

        # Check for oversized resources
        if resource['type'] == ResourceType.COMPUTE:
            # Would analyze CPU/memory usage and recommend right-sizing
            pass
        elif resource['type'] == ResourceType.STORAGE:
            # Would analyze storage usage and recommend lifecycle policies
            pass

        return recommendations

    async def _analyze_performance_optimization(self, resource: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze resource for performance optimization opportunities"""
        recommendations = []

        # Performance optimization logic would go here

        return recommendations

    async def _analyze_security_optimization(self, resource: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze resource for security optimization opportunities"""
        recommendations = []

        # Security optimization logic would go here

        return recommendations

    async def create_deployment_plan(
        self,
        tenant_id: str,
        plan_name: str,
        resources: List[Dict[str, Any]],
        dependencies: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, Any]:
        """
        Create a deployment plan for multiple resources

        Args:
            tenant_id: Tenant ID
            plan_name: Name of the deployment plan
            resources: List of resources to deploy
            dependencies: Resource dependencies

        Returns:
            Deployment plan details
        """
        try:
            plan_id = str(uuid4())

            # Create deployment plan in database
            deployment = CloudDeployment(
                id=plan_id,
                tenant_id=tenant_id,
                name=plan_name,
                resources=resources,
                dependencies=dependencies or {},
                status=DeploymentStatus.PENDING,
                created_at=datetime.now(timezone.utc)
            )

            async with get_db_session() as db:
                db.add(deployment)
                await db.commit()

            # Calculate deployment order based on dependencies
            deployment_order = self._calculate_deployment_order(resources, dependencies or {})

            return {
                'deployment_id': plan_id,
                'name': plan_name,
                'resources': resources,
                'dependencies': dependencies or {},
                'deployment_order': deployment_order,
                'estimated_cost': await self._estimate_deployment_cost(resources),
                'estimated_duration': await self._estimate_deployment_duration(resources)
            }

        except Exception as e:
            logger.error(f"Failed to create deployment plan: {str(e)}")
            raise

    def _calculate_deployment_order(
        self,
        resources: List[Dict[str, Any]],
        dependencies: Dict[str, List[str]]
    ) -> List[str]:
        """Calculate deployment order based on dependencies"""
        # Simple topological sort
        visited = set()
        order = []

        def visit(resource_name: str):
            if resource_name in visited:
                return
            if resource_name in dependencies:
                for dep in dependencies[resource_name]:
                    visit(dep)
            visited.add(resource_name)
            order.append(resource_name)

        for resource in resources:
            visit(resource['name'])

        return order

    async def _estimate_deployment_cost(self, resources: List[Dict[str, Any]]) -> float:
        """Estimate monthly cost for deployment"""
        # Cost estimation logic would go here
        return 0.0

    async def _estimate_deployment_duration(self, resources: List[Dict[str, Any]]) -> int:
        """Estimate deployment duration in minutes"""
        # Duration estimation logic would go here
        return 30

    async def execute_deployment_plan(self, deployment_id: str) -> Dict[str, Any]:
        """
        Execute a deployment plan

        Args:
            deployment_id: ID of the deployment plan

        Returns:
            Deployment execution results
        """
        try:
            # Get deployment plan
            async with get_db_session() as db:
                deployment = await db.get(CloudDeployment, deployment_id)
                if not deployment:
                    raise ValueError(f"Deployment {deployment_id} not found")

                if deployment.status != DeploymentStatus.PENDING:
                    raise ValueError(f"Deployment {deployment_id} is not in pending status")

                # Update status to in_progress
                deployment.status = DeploymentStatus.IN_PROGRESS
                await db.commit()

            # Execute deployment in order
            results = []

            for resource_name in deployment.deployment_order:
                resource_config = next(
                    (r for r in deployment.resources if r['name'] == resource_name),
                    None
                )

                if not resource_config:
                    continue

                try:
                    # Deploy resource
                    result = await self.deploy_resource(
                        deployment_id,
                        resource_config['provider_id'],
                        resource_config
                    )

                    results.append({
                        'resource_name': resource_name,
                        'status': 'success',
                        'resource_id': result.get('resource_id'),
                        'metadata': result
                    })

                except Exception as e:
                    results.append({
                        'resource_name': resource_name,
                        'status': 'failed',
                        'error': str(e)
                    })

                    # Stop deployment on failure
                    break

            # Update deployment status
            success_count = len([r for r in results if r['status'] == 'success'])
            if success_count == len(deployment.deployment_order):
                final_status = DeploymentStatus.SUCCESS
            else:
                final_status = DeploymentStatus.FAILED

            async with get_db_session() as db:
                deployment = await db.get(CloudDeployment, deployment_id)
                deployment.status = final_status
                deployment.deployment_results = results
                deployment.completed_at = datetime.now(timezone.utc)
                await db.commit()

            return {
                'deployment_id': deployment_id,
                'status': final_status,
                'results': results,
                'success_count': success_count,
                'total_count': len(deployment.deployment_order)
            }

        except Exception as e:
            logger.error(f"Failed to execute deployment plan {deployment_id}: {str(e)}")
            await self._update_deployment_status(deployment_id, DeploymentStatus.FAILED, str(e))
            raise

# Global service instance
multi_cloud_service = MultiCloudOrchestrationService()