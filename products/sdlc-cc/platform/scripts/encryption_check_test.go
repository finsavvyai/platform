// Tests for encryption_check.go. Same build tag — only the dedicated
// CI runner (which strips the tag) compiles this. Uses in-memory
// fakes for S3/RDS/EC2 so no AWS credentials are required.
//
//go:build ignore_for_module
// +build ignore_for_module

package main

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ec2"
	ec2types "github.com/aws/aws-sdk-go-v2/service/ec2/types"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	rdstypes "github.com/aws/aws-sdk-go-v2/service/rds/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

type fakeS3 struct{ enc map[string]string }

func (f *fakeS3) GetBucketEncryption(_ context.Context, in *s3.GetBucketEncryptionInput, _ ...func(*s3.Options)) (*s3.GetBucketEncryptionOutput, error) {
	alg, ok := f.enc[*in.Bucket]
	if !ok {
		return nil, errors.New("bucket not found")
	}
	if alg == "" {
		return &s3.GetBucketEncryptionOutput{}, nil
	}
	return &s3.GetBucketEncryptionOutput{
		ServerSideEncryptionConfiguration: &s3types.ServerSideEncryptionConfiguration{
			Rules: []s3types.ServerSideEncryptionRule{{
				ApplyServerSideEncryptionByDefault: &s3types.ServerSideEncryptionByDefault{
					SSEAlgorithm: s3types.ServerSideEncryption(alg),
				},
			}},
		},
	}, nil
}

type fakeRDS struct{ inst map[string]bool }

func (f *fakeRDS) DescribeDBInstances(_ context.Context, in *rds.DescribeDBInstancesInput, _ ...func(*rds.Options)) (*rds.DescribeDBInstancesOutput, error) {
	enc, ok := f.inst[*in.DBInstanceIdentifier]
	if !ok {
		return &rds.DescribeDBInstancesOutput{}, nil
	}
	return &rds.DescribeDBInstancesOutput{DBInstances: []rdstypes.DBInstance{{
		DBInstanceIdentifier: in.DBInstanceIdentifier, StorageEncrypted: aws.Bool(enc),
	}}}, nil
}

type fakeEC2 struct{ vols map[string][]bool }

func (f *fakeEC2) DescribeVolumes(_ context.Context, in *ec2.DescribeVolumesInput, _ ...func(*ec2.Options)) (*ec2.DescribeVolumesOutput, error) {
	if len(in.Filters) == 0 {
		return &ec2.DescribeVolumesOutput{}, nil
	}
	tag := strings.TrimPrefix(*in.Filters[0].Name, "tag:")
	val := in.Filters[0].Values[0]
	out := &ec2.DescribeVolumesOutput{}
	for i, e := range f.vols[tag+"="+val] {
		id := tag + "-" + val + "-" + string(rune('a'+i))
		out.Volumes = append(out.Volumes, ec2types.Volume{VolumeId: aws.String(id), Encrypted: aws.Bool(e)})
	}
	return out, nil
}

func goodManifest() *manifest {
	return &manifest{
		S3Buckets: []s3Bucket{
			{Name: "sdlc-prod-documents", ExpectedSSE: "aws:kms"},
			{Name: "sdlc-prod-exports", ExpectedSSE: "aws:kms"},
		},
		RDSInstances:    []rdsInstance{{ID: "sdlc-prod-postgres-primary", StorageEncrypted: true}},
		EBSVolumesByTag: []ebsTag{{Tag: "Service", Value: "redis", MustBeEncrypted: true}},
	}
}

func TestRun_AllEncrypted(t *testing.T) {
	c := AWSClients{
		S3:  &fakeS3{enc: map[string]string{"sdlc-prod-documents": "aws:kms", "sdlc-prod-exports": "aws:kms"}},
		RDS: &fakeRDS{inst: map[string]bool{"sdlc-prod-postgres-primary": true}},
		EC2: &fakeEC2{vols: map[string][]bool{"Service=redis": {true, true}}},
	}
	var buf bytes.Buffer
	if code := Run(context.Background(), goodManifest(), c, &buf); code != 0 {
		t.Fatalf("expected 0, got %d. log=%s", code, buf.String())
	}
	if !strings.Contains(buf.String(), "OK") {
		t.Errorf("expected OK in output, got %s", buf.String())
	}
}

func TestRun_S3Unencrypted(t *testing.T) {
	c := AWSClients{
		S3:  &fakeS3{enc: map[string]string{"sdlc-prod-documents": "aws:kms", "sdlc-prod-exports": ""}},
		RDS: &fakeRDS{inst: map[string]bool{"sdlc-prod-postgres-primary": true}},
		EC2: &fakeEC2{vols: map[string][]bool{"Service=redis": {true}}},
	}
	var buf bytes.Buffer
	if code := Run(context.Background(), goodManifest(), c, &buf); code != 1 {
		t.Fatalf("expected 1, got %d. log=%s", code, buf.String())
	}
	if !strings.Contains(buf.String(), "sdlc-prod-exports") {
		t.Errorf("expected failing bucket name, got %s", buf.String())
	}
}

func TestRun_RDSUnencrypted(t *testing.T) {
	c := AWSClients{
		S3:  &fakeS3{enc: map[string]string{"sdlc-prod-documents": "aws:kms", "sdlc-prod-exports": "aws:kms"}},
		RDS: &fakeRDS{inst: map[string]bool{"sdlc-prod-postgres-primary": false}},
		EC2: &fakeEC2{vols: map[string][]bool{"Service=redis": {true}}},
	}
	var buf bytes.Buffer
	if code := Run(context.Background(), goodManifest(), c, &buf); code != 1 {
		t.Fatalf("expected 1, got %d. log=%s", code, buf.String())
	}
	if !strings.Contains(buf.String(), "storage_encrypted=false") {
		t.Errorf("expected RDS failure log, got %s", buf.String())
	}
}

func TestRun_EBSUnencrypted(t *testing.T) {
	c := AWSClients{
		S3:  &fakeS3{enc: map[string]string{"sdlc-prod-documents": "aws:kms", "sdlc-prod-exports": "aws:kms"}},
		RDS: &fakeRDS{inst: map[string]bool{"sdlc-prod-postgres-primary": true}},
		EC2: &fakeEC2{vols: map[string][]bool{"Service=redis": {true, false}}},
	}
	var buf bytes.Buffer
	if code := Run(context.Background(), goodManifest(), c, &buf); code != 1 {
		t.Fatalf("expected 1, got %d. log=%s", code, buf.String())
	}
	if !strings.Contains(buf.String(), "not encrypted") {
		t.Errorf("expected EBS failure log, got %s", buf.String())
	}
}

func TestLoadManifest_Missing(t *testing.T) {
	if _, err := LoadManifest(filepath.Join(t.TempDir(), "nope.json")); err == nil {
		t.Fatal("expected error for missing manifest")
	}
}

func TestLoadManifest_Valid(t *testing.T) {
	p := filepath.Join(t.TempDir(), "m.json")
	body := `{"s3_buckets":[{"name":"b1","expected_sse":"aws:kms"}],"rds_instances":[],"ebs_volumes_by_tag":[]}`
	if err := os.WriteFile(p, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
	m, err := LoadManifest(p)
	if err != nil {
		t.Fatalf("LoadManifest: %v", err)
	}
	if len(m.S3Buckets) != 1 || m.S3Buckets[0].Name != "b1" {
		t.Fatalf("bad parse: %+v", m)
	}
}
