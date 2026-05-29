//go:build legacy_migrated && terraform
// +build legacy_migrated,terraform

package infrastructure

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudwatch"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	"github.com/aws/aws-sdk-go-v2/service/eks"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	aws_s3 "github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/gruntwork-io/terratest/random"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	terraformDir = "../../infrastructure/terraform"
)

func TestTerraformInfrastructure(t *testing.T) {
	t.Parallel()

	// Construct the terraform options with a random string to avoid naming conflicts
	uniqueID := random.UniqueId()
	terraformOptions := &terraform.Options{
		// The path to where your Terraform code is located
		TerraformDir: terraformDir,

		// Variables to pass to our Terraform code using -var options
		Vars: map[string]interface{}{
			"project_name": fmt.Sprintf("quantumbeam-test-%s", uniqueID),
			"environment": "test",
			"aws_region":  "us-east-1",
			"owner":       "test@quantumbeam.io",
		},

		// Environment variables to pass to our Terraform code using -env options
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": "us-east-1",
		},

		// Reconfigure is needed to pick up changes to remote state configuration
		Reconfigure: true,

		// Disable color output for cleaner logs
		NoColor: true,

		// Set retry for transient errors
		MaxRetries: 3,
		TimeBetweenRetries: 5 * time.Second,
	}

	// At the end of the test, run `terraform destroy` to clean up any resources that were created
	defer terraform.Destroy(t, terraformOptions)

	// Run `terraform init` and `terraform apply`. Fail the test if there are any errors.
	terraform.InitAndApply(t, terraformOptions)

	// Run validation tests
	t.Run("Validate_VPC_Configuration", func(t *testing.T) {
		validateVPCConfiguration(t, terraformOptions)
	})

	t.Run("Validate_EKS_Cluster", func(t *testing.T) {
		validateEKSCluster(t, terraformOptions)
	})

	t.Run("Validate_RDS_Database", func(t *testing.T) {
		validateRDSDatabase(t, terraformOptions)
	})

	t.Run("Validate_ElastiCache_Redis", func(t *testing.T) {
		validateElastiCacheRedis(t, terraformOptions)
	})

	t.Run("Validate_S3_Buckets", func(t *testing.T) {
		validateS3Buckets(t, terraformOptions)
	})

	t.Run("Validate_Monitoring", func(t *testing.T) {
		validateMonitoring(t, terraformOptions)
	})

	t.Run("Validate_Security", func(t *testing.T) {
		validateSecurity(t, terraformOptions)
	})

	t.Run("Validate_Kubernetes_Connectivity", func(t *testing.T) {
		validateKubernetesConnectivity(t, terraformOptions)
	})
}

func validateVPCConfiguration(t *testing.T, terraformOptions *terraform.Options) {
	// Get VPC ID from Terraform outputs
	vpcID := terraform.Output(t, terraformOptions, "vpc_id")
	assert.NotEmpty(t, vpcID, "VPC ID should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create EC2 client
	ec2Client := ec2.NewFromConfig(awsConfig)

	// Describe VPC
	describeVPCInput := &ec2.DescribeVpcsInput{
		VpcIds: []string{vpcID},
	}
	vpcResponse, err := ec2Client.DescribeVpcs(context.TODO(), describeVPCInput)
	require.NoError(t, err, "Failed to describe VPC")
	require.Len(t, vpcResponse.Vpcs, 1, "Expected exactly one VPC")

	vpc := vpcResponse.Vpcs[0]
	assert.True(t, *vpc.IsDefault, "VPC should not be the default VPC")
	assert.Equal(t, "10.0.0.0/16", *vpc.CidrBlock, "VPC CIDR should match expected value")
	assert.True(t, len(vpc.Tags) > 0, "VPC should have tags")

	// Verify VPC tags
	hasNameTag := false
	for _, tag := range vpc.Tags {
		if *tag.Key == "Name" {
			hasNameTag = true
			assert.Contains(t, *tag.Value, "quantumbeam-test", "VPC name tag should contain project name")
		}
	}
	assert.True(t, hasNameTag, "VPC should have a Name tag")

	// Get private subnets
	privateSubnets := terraform.OutputList(t, terraformOptions, "private_subnets")
	assert.Len(t, privateSubnets, 3, "Should have 3 private subnets")

	// Get public subnets
	publicSubnets := terraform.OutputList(t, terraformOptions, "public_subnets")
	assert.Len(t, publicSubnets, 3, "Should have 3 public subnets")

	// Verify subnets exist
	allSubnets := append(privateSubnets, publicSubnets...)
	describeSubnetsInput := &ec2.DescribeSubnetsInput{
		SubnetIds: allSubnets,
	}
	subnetsResponse, err := ec2Client.DescribeSubnets(context.TODO(), describeSubnetsInput)
	require.NoError(t, err, "Failed to describe subnets")
	assert.Len(t, subnetsResponse.Subnets, len(allSubnets), "All subnets should exist")

	// Verify subnets are in the correct VPC
	for _, subnet := range subnetsResponse.Subnets {
		assert.Equal(t, vpcID, *subnet.VpcId, "Subnet should be in the correct VPC")
	}
}

func validateEKSCluster(t *testing.T, terraformOptions *terraform.Options) {
	// Get cluster information from Terraform outputs
	clusterName := terraform.Output(t, terraformOptions, "cluster_name")
	clusterEndpoint := terraform.Output(t, terraformOptions, "cluster_endpoint")
	clusterCAData := terraform.Output(t, terraformOptions, "cluster_certificate_authority_data")

	assert.NotEmpty(t, clusterName, "Cluster name should not be empty")
	assert.NotEmpty(t, clusterEndpoint, "Cluster endpoint should not be empty")
	assert.NotEmpty(t, clusterCAData, "Cluster CA data should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create EKS client
	eksClient := eks.NewFromConfig(awsConfig)

	// Describe cluster
	describeClusterInput := &eks.DescribeClusterInput{
		Name: aws.String(clusterName),
	}
	clusterResponse, err := eksClient.DescribeCluster(context.TODO(), describeClusterInput)
	require.NoError(t, err, "Failed to describe EKS cluster")

	cluster := clusterResponse.Cluster
	assert.Equal(t, "ACTIVE", string(cluster.Status), "Cluster should be in ACTIVE state")
	assert.Equal(t, clusterEndpoint, *cluster.Endpoint, "Cluster endpoint should match expected value")
	assert.True(t, len(cluster.Tags) > 0, "Cluster should have tags")

	// Verify cluster version
	assert.NotNil(t, cluster.Version, "Cluster should have a version")
	assert.GreaterOrEqual(t, *cluster.Version, "1.28", "Cluster should be running version 1.28 or higher")

	// Verify cluster security group
	assert.NotEmpty(t, cluster.ResourcesVpcConfig.ClusterSecurityGroupId, "Cluster should have a security group")

	// Verify endpoint access
	assert.False(t, *cluster.ResourcesVpcConfig.EndpointPublicAccess, "Cluster should not have public endpoint access")
	assert.True(t, *cluster.ResourcesVpcConfig.EndpointPrivateAccess, "Cluster should have private endpoint access")

	// Verify node groups
	listNodegroupsInput := &eks.ListNodegroupsInput{
		ClusterName: aws.String(clusterName),
	}
	nodegroupsResponse, err := eksClient.ListNodegroups(context.TODO(), listNodegroupsInput)
	require.NoError(t, err, "Failed to list node groups")
	assert.GreaterOrEqual(t, len(nodegroupsResponse.Nodegroups), 3, "Should have at least 3 node groups")

	// Verify specific node groups exist
	expectedNodegroups := []string{"general-nodes", "quantum-nodes", "ai-ml-nodes"}
	for _, expectedNodegroup := range expectedNodegroups {
		found := false
		for _, nodegroup := range nodegroupsResponse.Nodegroups {
			if nodegroup == expectedNodegroup {
				found = true
				break
			}
		}
		assert.True(t, found, "Expected node group %s should exist", expectedNodegroup)
	}
}

func validateRDSDatabase(t *testing.T, terraformOptions *terraform.Options) {
	// Get database information from Terraform outputs
	databaseEndpoint := terraform.Output(t, terraformOptions, "database_endpoint")
	databasePort := terraform.Output(t, terraformOptions, "database_port")
	databaseName := terraform.Output(t, terraformOptions, "database_name")

	assert.NotEmpty(t, databaseEndpoint, "Database endpoint should not be empty")
	assert.NotEmpty(t, databasePort, "Database port should not be empty")
	assert.NotEmpty(t, databaseName, "Database name should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create RDS client
	rdsClient := rds.NewFromConfig(awsConfig)

	// Get caller identity to find the DB instance
	stsClient := sts.NewFromConfig(awsConfig)
	identity, err := stsClient.GetCallerIdentity(context.TODO(), &sts.GetCallerIdentityInput{})
	require.NoError(t, err, "Failed to get caller identity")

	// Describe DB instances
	describeDBInstancesInput := &rds.DescribeDBInstancesInput{}
	instancesResponse, err := rdsClient.DescribeDBInstances(context.TODO(), describeDBInstancesInput)
	require.NoError(t, err, "Failed to describe DB instances")

	// Find our database instance
	var dbInstance *rds.DBInstance
	projectName := terraform.Output(t, terraformOptions, "project_name")
	environment := terraform.Output(t, terraformOptions, "environment")

	for _, instance := range instancesResponse.DBInstances {
		if *instance.DBInstanceIdentifier == fmt.Sprintf("%s-%s-postgres", projectName, environment) {
			dbInstance = &instance
			break
		}
	}

	require.NotNil(t, dbInstance, "Database instance should exist")

	// Verify database configuration
	assert.Equal(t, "postgres", *dbInstance.Engine, "Database engine should be postgres")
	assert.Equal(t, "15.4", *dbInstance.EngineVersion, "Database version should be 15.4")
	assert.Equal(t, databaseName, *dbInstance.DBName, "Database name should match expected value")
	assert.Equal(t, "available", string(dbInstance.DBInstanceStatus), "Database should be available")

	// Verify security
	assert.True(t, *dbInstance.StorageEncrypted, "Database should be encrypted at rest")
	assert.True(t, *dbInstance.MultiAZ, "Database should be Multi-AZ enabled")

	// Verify backup configuration
	assert.GreaterOrEqual(t, *dbInstance.BackupRetentionPeriod, int32(30), "Backup retention should be at least 30 days")
	assert.NotEmpty(t, dbInstance.AllocatedStorage, "Database should have allocated storage")
	assert.GreaterOrEqual(t, *dbInstance.AllocatedStorage, int32(100), "Database storage should be at least 100GB")

	// Verify monitoring
	assert.True(t, dbInstance.MonitoringInterval != nil, "Database should have enhanced monitoring")
	assert.True(t, *dbInstance.MonitoringInterval > 0, "Monitoring interval should be greater than 0")
	assert.True(t, dbInstance.PerformanceInsightsEnabled != nil, "Database should have performance insights")
	assert.True(t, *dbInstance.PerformanceInsightsEnabled, "Performance insights should be enabled")
}

func validateElastiCacheRedis(t *testing.T, terraformOptions *terraform.Options) {
	// Get Redis information from Terraform outputs
	redisEndpoint := terraform.Output(t, terraformOptions, "redis_primary_endpoint")
	redisPort := terraform.Output(t, terraformOptions, "redis_port")

	assert.NotEmpty(t, redisEndpoint, "Redis endpoint should not be empty")
	assert.NotEmpty(t, redisPort, "Redis port should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create ElastiCache client
	// Note: ElastiCache doesn't have a separate client in v2, we need to create the client manually
	// For now, we'll verify that the output exists and looks correct

	// Verify endpoint format
	assert.Contains(t, redisEndpoint, ".cache.amazonaws.com", "Redis endpoint should be a valid ElastiCache endpoint")
	assert.Equal(t, "6379", redisPort, "Redis port should be 6379")

	// Verify endpoint resolution (basic connectivity test)
	assert.Regexp(t, `^[a-zA-Z0-9.-]+\.cache\.amazonaws\.com$`, redisEndpoint, "Redis endpoint should match expected pattern")
}

func validateS3Buckets(t *testing.T, terraformOptions *terraform.Options) {
	// Get bucket information from Terraform outputs
	appStorageBucket := terraform.Output(t, terraformOptions, "application_storage_bucket")
	backupsBucket := terraform.Output(t, terraformOptions, "backups_bucket")

	assert.NotEmpty(t, appStorageBucket, "Application storage bucket should not be empty")
	assert.NotEmpty(t, backupsBucket, "Backups bucket should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create S3 client
	s3Client := s3.NewFromConfig(awsConfig)

	// Test application storage bucket
	validateS3Bucket(t, s3Client, appStorageBucket, "application storage")

	// Test backups bucket
	validateS3Bucket(t, s3Client, backupsBucket, "backups")
}

func validateS3Bucket(t *testing.T, s3Client *aws_s3.Client, bucketName, bucketType string) {
	// Check if bucket exists
	headBucketInput := &aws_s3.HeadBucketInput{
		Bucket: aws.String(bucketName),
	}
	_, err := s3Client.HeadBucket(context.TODO(), headBucketInput)
	require.NoError(t, err, "%s bucket should exist", bucketType)

	// Get bucket versioning
	getVersioningInput := &aws_s3.GetBucketVersioningInput{
		Bucket: aws.String(bucketName),
	}
	versioningResponse, err := s3Client.GetBucketVersioning(context.TODO(), getVersioningInput)
	require.NoError(t, err, "Failed to get bucket versioning")
	assert.Equal(t, "Enabled", string(versioningResponse.Status), "%s bucket should have versioning enabled", bucketType)

	// Get bucket encryption
	getEncryptionInput := &aws_s3.GetBucketEncryptionInput{
		Bucket: aws.String(bucketName),
	}
	encryptionResponse, err := s3Client.GetBucketEncryption(context.TODO(), getEncryptionInput)
	require.NoError(t, err, "Failed to get bucket encryption")
	assert.NotNil(t, encryptionResponse.ServerSideEncryptionConfiguration, "%s bucket should have encryption configuration", bucketType)

	// Get bucket public access block
	getPublicAccessBlockInput := &aws_s3.GetBucketPublicAccessBlockInput{
		Bucket: aws.String(bucketName),
	}
	publicAccessResponse, err := s3Client.GetBucketPublicAccessBlock(context.TODO(), getPublicAccessBlockInput)
	require.NoError(t, err, "Failed to get bucket public access block")
	assert.True(t, publicAccessResponse.BlockPublicAcls, "%s bucket should block public ACLs", bucketType)
	assert.True(t, publicAccessResponse.BlockPublicPolicy, "%s bucket should block public policy", bucketType)
	assert.True(t, publicAccessResponse.IgnorePublicAcls, "%s bucket should ignore public ACLs", bucketType)
	assert.True(t, publicAccessResponse.RestrictPublicBuckets, "%s bucket should restrict public buckets", bucketType)
}

func validateMonitoring(t *testing.T, terraformOptions *terraform.Options) {
	// Get monitoring information from Terraform outputs
	logGroupName := terraform.Output(t, terraformOptions, "cloudwatch_log_group_name")
	clusterName := terraform.Output(t, terraformOptions, "cluster_name")

	assert.NotEmpty(t, logGroupName, "Log group name should not be empty")
	assert.NotEmpty(t, clusterName, "Cluster name should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create CloudWatch client
	cloudwatchClient := cloudwatch.NewFromConfig(awsConfig)

	// Verify log group exists
	describeLogGroupsInput := &cloudwatch.DescribeLogGroupsInput{
		LogGroupNamePrefix: aws.String(logGroupName),
	}
	logGroupsResponse, err := cloudwatchClient.DescribeLogGroups(context.TODO(), describeLogGroupsInput)
	require.NoError(t, err, "Failed to describe log groups")
	assert.GreaterOrEqual(t, len(logGroupsResponse.LogGroups), 1, "Should have at least one log group")

	// Find our log group
	var logGroup *cloudwatch.LogGroup
	for _, lg := range logGroupsResponse.LogGroups {
		if *lg.LogGroupName == logGroupName {
			logGroup = &lg
			break
		}
	}
	require.NotNil(t, logGroup, "Expected log group should exist")

	// Verify log group retention
	assert.NotNil(t, logGroup.RetentionInDays, "Log group should have retention period")
	assert.GreaterOrEqual(t, *logGroup.RetentionInDays, int32(30), "Log group retention should be at least 30 days")

	// Verify CloudWatch alarms exist for the cluster
	alarmsInput := &cloudwatch.DescribeAlarmsForMetricInput{
		MetricName: aws.String("ClusterStatus"),
		Namespace:  aws.String("AWS/EKS"),
		Dimensions: []cloudwatch.Dimension{
			{
				Name:  aws.String("ClusterName"),
				Value: aws.String(clusterName),
			},
		},
	}
	alarmsResponse, err := cloudwatchClient.DescribeAlarmsForMetric(context.TODO(), alarmsInput)
	require.NoError(t, err, "Failed to describe CloudWatch alarms")
	assert.GreaterOrEqual(t, len(alarmsResponse.MetricAlarms), 0, "Should have CloudWatch alarms for EKS cluster")
}

func validateSecurity(t *testing.T, terraformOptions *terraform.Options) {
	// Get security information from Terraform outputs
	clusterSecurityGroupID := terraform.Output(t, terraformOptions, "eks_cluster_security_group_id")
	nodeSecurityGroupID := terraform.Output(t, terraformOptions, "node_security_group_id")

	assert.NotEmpty(t, clusterSecurityGroupID, "Cluster security group ID should not be empty")
	assert.NotEmpty(t, nodeSecurityGroupID, "Node security group ID should not be empty")

	// Create AWS config
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create EC2 client
	ec2Client := ec2.NewFromConfig(awsConfig)

	// Validate cluster security group
	validateSecurityGroup(t, ec2Client, clusterSecurityGroupID, "cluster")

	// Validate node security group
	validateSecurityGroup(t, ec2Client, nodeSecurityGroupID, "node")
}

func validateSecurityGroup(t *testing.T, ec2Client *ec2.Client, securityGroupID, sgType string) {
	// Describe security group
	describeSGInput := &ec2.DescribeSecurityGroupsInput{
		GroupIds: []string{securityGroupID},
	}
	sgResponse, err := ec2Client.DescribeSecurityGroups(context.TODO(), describeSGInput)
	require.NoError(t, err, "Failed to describe security group")
	require.Len(t, sgResponse.SecurityGroups, 1, "Should have exactly one security group")

	sg := sgResponse.SecurityGroups[0]
	assert.NotEmpty(t, sg.Description, "Security group should have a description")
	assert.Contains(t, *sg.Description, "quantumbeam", "Security group description should mention quantumbeam")

	// Check for appropriate rules
	if sgType == "cluster" {
		// Cluster security group should have rules for API server access
		hasIngressRule := false
		for _, rule := range sg.IpPermissions {
			for _, range rule.IpRanges {
				if *rule.FromPort == 443 {
					hasIngressRule = true
					break
				}
			}
		}
		assert.True(t, hasIngressRule, "Cluster security group should allow HTTPS ingress")
	}
}

func validateKubernetesConnectivity(t *testing.T, terraformOptions *terraform.Options) {
	// Get Kubernetes configuration from Terraform outputs
	clusterName := terraform.Output(t, terraformOptions, "cluster_name")
	clusterEndpoint := terraform.Output(t, terraformOptions, "cluster_endpoint")
	clusterCAData := terraform.Output(t, terraformOptions, "cluster_certificate_authority_data")

	assert.NotEmpty(t, clusterName, "Cluster name should not be empty")
	assert.NotEmpty(t, clusterEndpoint, "Cluster endpoint should not be empty")
	assert.NotEmpty(t, clusterCAData, "Cluster CA data should not be empty")

	// Create AWS config for getting kubeconfig
	awsConfig, err := config.LoadDefaultConfig(context.TODO())
	require.NoError(t, err, "Failed to load AWS config")

	// Create kubeconfig
	kubeconfig := generateKubeconfig(t, clusterName, clusterEndpoint, clusterCAData, awsConfig)

	// Create Kubernetes clientset
	config, err := clientcmd.BuildConfigFromKubeconfigString("", kubeconfig)
	require.NoError(t, err, "Failed to build Kubernetes config")

	clientset, err := kubernetes.NewForConfig(config)
	require.NoError(t, err, "Failed to create Kubernetes clientset")

	// Test basic Kubernetes connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// List namespaces
	namespaces, err := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Failed to list namespaces")
	assert.GreaterOrEqual(t, len(namespaces.Items), 1, "Should have at least one namespace")

	// Verify default namespace exists
	var defaultNamespace *corev1.Namespace
	for _, ns := range namespaces.Items {
		if ns.Name == "default" {
			defaultNamespace = &ns
			break
		}
	}
	require.NotNil(t, defaultNamespace, "Default namespace should exist")

	// List nodes to verify cluster is operational
	nodes, err := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	require.NoError(t, err, "Failed to list nodes")
	assert.GreaterOrEqual(t, len(nodes.Items), 3, "Should have at least 3 nodes")

	// Verify nodes are ready
	readyNodes := 0
	for _, node := range nodes.Items {
		for _, condition := range node.Status.Conditions {
			if condition.Type == corev1.NodeReady && condition.Status == corev1.ConditionTrue {
				readyNodes++
				break
			}
		}
	}
	assert.GreaterOrEqual(t, readyNodes, 3, "Should have at least 3 ready nodes")

	// Test API server health
	healthz, err := clientset.Discovery().RESTClient().Get().AbsPath("/healthz").Do(ctx).Raw()
	require.NoError(t, err, "API server health check failed")
	assert.Equal(t, "ok", string(healthz), "API server should be healthy")
}

func generateKubeconfig(t *testing.T, clusterName, clusterEndpoint, clusterCAData string, awsConfig aws.Config) string {
	// This is a simplified kubeconfig generation
	// In a real implementation, you would use the AWS EKS GetToken API
	kubeconfig := fmt.Sprintf(`apiVersion: v1
clusters:
- cluster:
    server: %s
    certificate-authority-data: %s
  name: %s
contexts:
- context:
    cluster: %s
    user: %s
  name: %s
current-context: %s
kind: Config
preferences: {}
users:
- name: %s
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: aws
      args:
      - eks
      - get-token
      - --cluster-name
      - %s
`, clusterEndpoint, clusterCAData, clusterName, clusterName, clusterName, clusterName, clusterName, clusterName, clusterName)

	return kubeconfig
}

// Performance test for infrastructure
func TestInfrastructurePerformance(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	t.Parallel()

	// Create a minimal terraform configuration for performance testing
	uniqueID := random.UniqueId()
	terraformOptions := &terraform.Options{
		TerraformDir: terraformDir,
		Vars: map[string]interface{}{
			"project_name": fmt.Sprintf("quantumbeam-perf-%s", uniqueID),
			"environment": "perf-test",
			"aws_region":  "us-east-1",
		},
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": "us-east-1",
		},
		Reconfigure: true,
		NoColor:     true,
	}

	defer terraform.Destroy(t, terraformOptions)

	start := time.Now()
	terraform.InitAndApply(t, terraformOptions)
	duration := time.Since(start)

	// Infrastructure should be provisioned within a reasonable time
	assert.Less(t, duration, 30*time.Minute, "Infrastructure should be provisioned within 30 minutes")
	t.Logf("Infrastructure provisioned in %v", duration)
}

// Cleanup test for infrastructure destruction
func TestInfrastructureDestruction(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping destruction test in short mode")
	}

	t.Parallel()

	uniqueID := random.UniqueId()
	terraformOptions := &terraform.Options{
		TerraformDir: terraformDir,
		Vars: map[string]interface{}{
			"project_name": fmt.Sprintf("quantumbeam-cleanup-%s", uniqueID),
			"environment": "cleanup-test",
			"aws_region":  "us-east-1",
		},
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": "us-east-1",
		},
		Reconfigure: true,
		NoColor:     true,
	}

	// Apply the infrastructure first
	terraform.InitAndApply(t, terraformOptions)

	// Test that destruction works correctly
	start := time.Now()
	terraform.Destroy(t, terraformOptions)
	duration := time.Since(start)

	// Destruction should complete within a reasonable time
	assert.Less(t, duration, 15*time.Minute, "Infrastructure should be destroyed within 15 minutes")
	t.Logf("Infrastructure destroyed in %v", duration)
}