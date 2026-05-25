// REAL — uses aws-sdk-go-v2. Required SDK modules:
//   github.com/aws/aws-sdk-go-v2 (core)
//   github.com/aws/aws-sdk-go-v2/config
//   github.com/aws/aws-sdk-go-v2/service/s3
//   github.com/aws/aws-sdk-go-v2/service/rds
//   github.com/aws/aws-sdk-go-v2/service/ec2
// CI workflow runs go run with this file standalone; the build tag
// keeps it out of the gateway binary. See encryption-check.yml.
//
// Reads deployments/encryption-manifest.json and verifies via real
// AWS API calls. Exit codes:
//   0 = all encrypted, 1 = at least one unencrypted, 2 = manifest
//   missing/invalid OR AWS auth/transport error.
//
//go:build ignore_for_module
// +build ignore_for_module

package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type s3Bucket struct {
	Name                string `json:"name"`
	Region              string `json:"region"`
	ExpectedSSE         string `json:"expected_sse"`
	ExpectedKMSKeyAlias string `json:"expected_kms_key_alias"`
	RotationDays        int    `json:"rotation_days"`
}

type rdsInstance struct {
	ID                  string `json:"id"`
	Region              string `json:"region"`
	StorageEncrypted    bool   `json:"storage_encrypted"`
	ExpectedKMSKeyAlias string `json:"expected_kms_key_alias"`
}

type ebsTag struct {
	Tag             string `json:"tag"`
	Value           string `json:"value"`
	MustBeEncrypted bool   `json:"must_be_encrypted"`
}

type manifest struct {
	Description     string        `json:"description"`
	S3Buckets       []s3Bucket    `json:"s3_buckets"`
	RDSInstances    []rdsInstance `json:"rds_instances"`
	EBSVolumesByTag []ebsTag      `json:"ebs_volumes_by_tag"`
}

// S3API/RDSAPI/EC2API expose just the calls we make so tests can fake them.
type S3API interface {
	GetBucketEncryption(ctx context.Context, in *s3.GetBucketEncryptionInput, opts ...func(*s3.Options)) (*s3.GetBucketEncryptionOutput, error)
}
type RDSAPI interface {
	DescribeDBInstances(ctx context.Context, in *rds.DescribeDBInstancesInput, opts ...func(*rds.Options)) (*rds.DescribeDBInstancesOutput, error)
}
type EC2API interface {
	DescribeVolumes(ctx context.Context, in *ec2.DescribeVolumesInput, opts ...func(*ec2.Options)) (*ec2.DescribeVolumesOutput, error)
}

// AWSClients bundles the three API seams.
type AWSClients struct {
	S3  S3API
	RDS RDSAPI
	EC2 EC2API
}

// Run performs the verification and returns the exit code (0/1).
func Run(ctx context.Context, m *manifest, c AWSClients, out io.Writer) int {
	failures := 0
	for _, b := range m.S3Buckets {
		o, err := c.S3.GetBucketEncryption(ctx, &s3.GetBucketEncryptionInput{Bucket: aws.String(b.Name)})
		if err != nil {
			fmt.Fprintf(out, "FAIL: s3 bucket %q encryption lookup: %v\n", b.Name, err)
			failures++
			continue
		}
		if o.ServerSideEncryptionConfiguration == nil || len(o.ServerSideEncryptionConfiguration.Rules) == 0 {
			fmt.Fprintf(out, "FAIL: s3 bucket %q has no SSE configured\n", b.Name)
			failures++
			continue
		}
		ok := false
		for _, r := range o.ServerSideEncryptionConfiguration.Rules {
			if r.ApplyServerSideEncryptionByDefault == nil {
				continue
			}
			alg := string(r.ApplyServerSideEncryptionByDefault.SSEAlgorithm)
			if alg == "aws:kms" || alg == "AES256" {
				ok = true
				break
			}
		}
		if !ok {
			fmt.Fprintf(out, "FAIL: s3 bucket %q SSE algorithm is not aws:kms or AES256\n", b.Name)
			failures++
		}
	}
	for _, r := range m.RDSInstances {
		o, err := c.RDS.DescribeDBInstances(ctx, &rds.DescribeDBInstancesInput{DBInstanceIdentifier: aws.String(r.ID)})
		if err != nil {
			fmt.Fprintf(out, "FAIL: rds %q describe: %v\n", r.ID, err)
			failures++
			continue
		}
		if len(o.DBInstances) == 0 {
			fmt.Fprintf(out, "FAIL: rds %q not found\n", r.ID)
			failures++
			continue
		}
		inst := o.DBInstances[0]
		if inst.StorageEncrypted == nil || !*inst.StorageEncrypted {
			fmt.Fprintf(out, "FAIL: rds %q storage_encrypted=false\n", r.ID)
			failures++
		}
	}
	for _, e := range m.EBSVolumesByTag {
		o, err := c.EC2.DescribeVolumes(ctx, &ec2.DescribeVolumesInput{
			Filters: []ec2types.Filter{{Name: aws.String("tag:" + e.Tag), Values: []string{e.Value}}},
		})
		if err != nil {
			fmt.Fprintf(out, "FAIL: ebs tag %s=%s describe: %v\n", e.Tag, e.Value, err)
			failures++
			continue
		}
		for _, v := range o.Volumes {
			id := ""
			if v.VolumeId != nil {
				id = *v.VolumeId
			}
			if v.Encrypted == nil || !*v.Encrypted {
				fmt.Fprintf(out, "FAIL: ebs volume %s (tag %s=%s) not encrypted\n", id, e.Tag, e.Value)
				failures++
			}
		}
	}
	if failures > 0 {
		fmt.Fprintf(out, "encryption-check: %d failure(s)\n", failures)
		return 1
	}
	fmt.Fprintf(out, "encryption-check: OK — %d s3, %d rds, %d ebs-tag rules verified\n",
		len(m.S3Buckets), len(m.RDSInstances), len(m.EBSVolumesByTag))
	return 0
}

// LoadManifest reads + parses the manifest JSON file.
func LoadManifest(path string) (*manifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// defaultAWSClients builds clients from the default credential chain.
func defaultAWSClients(ctx context.Context) (AWSClients, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return AWSClients{}, err
	}
	return AWSClients{S3: s3.NewFromConfig(cfg), RDS: rds.NewFromConfig(cfg), EC2: ec2.NewFromConfig(cfg)}, nil
}

func main() {
	path := flag.String("manifest", "deployments/encryption-manifest.json", "path to encryption manifest")
	flag.Parse()
	m, err := LoadManifest(*path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL CLOSED: manifest unreadable at %s: %v\n", *path, err)
		os.Exit(2)
	}
	ctx := context.Background()
	clients, err := defaultAWSClients(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL CLOSED: aws config: %v\n", err)
		os.Exit(2)
	}
	os.Exit(Run(ctx, m, clients, os.Stdout))
}
