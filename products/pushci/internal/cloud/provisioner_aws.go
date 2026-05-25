package cloud

import (
	"fmt"
	"sync/atomic"
	"time"
)

var awsSeq atomic.Int64

// AWSSpotProvisioner provisions runners on AWS EC2 Spot Instances.
type AWSSpotProvisioner struct {
	AccessKeyID     string
	SecretAccessKey string
	Region          string
	SubnetID        string
	SecurityGroupID string
}

// NewAWSSpotProvisioner creates an AWS Spot provisioner.
func NewAWSSpotProvisioner(accessKey, secretKey, region string) *AWSSpotProvisioner {
	return &AWSSpotProvisioner{
		AccessKeyID:     accessKey,
		SecretAccessKey: secretKey,
		Region:          region,
	}
}

// Create launches a spot instance with the runner agent.
// Production: calls RunInstances with InstanceMarketOptions.
func (a *AWSSpotProvisioner) Create(spec VMSpec) (*Runner, error) {
	if a.AccessKeyID == "" {
		return nil, fmt.Errorf("aws: credentials not configured")
	}
	seq := awsSeq.Add(1)
	id := fmt.Sprintf("aws-%s-%d-%d", spec.Name, time.Now().UnixMilli(), seq)
	region := a.Region
	if spec.Region != "" {
		region = spec.Region
	}
	return &Runner{
		ID:            id,
		IP:            "",
		Status:        StatusStarting,
		Labels:        append(spec.Labels, "aws", "spot", region),
		OS:            spec.Image,
		Arch:          "amd64",
		CreatedAt:     time.Now(),
		LastHeartbeat: time.Now(),
	}, nil
}

// Destroy terminates the spot instance.
// Production: calls TerminateInstances.
func (a *AWSSpotProvisioner) Destroy(id string) error {
	if a.AccessKeyID == "" {
		return fmt.Errorf("aws: credentials not configured")
	}
	return nil
}
