package deploy

import (
	"context"
	"testing"
)

func TestDeployUnknownTarget(t *testing.T) {
	r := Deploy(context.Background(), "nonexistent", ".", nil)
	if r.Success {
		t.Error("expected failure for unknown target")
	}
	if r.Output == "" {
		t.Error("expected error message in output")
	}
	if r.Target != "nonexistent" {
		t.Errorf("target = %q, want nonexistent", r.Target)
	}
}

func TestDeployTargetMapping(t *testing.T) {
	tests := []struct {
		name   string
		target Target
	}{
		{"cloudflare pages", TargetCloudflarePages},
		{"cloudflare workers", TargetCloudflareWorkers},
		{"aws ecs", TargetAWSECS},
		{"aws lambda", TargetAWSLambda},
		{"aws s3", TargetAWSS3},
		{"gcp cloud run", TargetGCPCloudRun},
		{"gcp app engine", TargetGCPAppEngine},
		{"azure", TargetAzureAppService},
		{"docker", TargetDocker},
		{"k8s", TargetK8s},
		{"vercel", TargetVercel},
		{"railway", TargetRailway},
		{"fly", TargetFly},
		{"netlify", TargetNetlify},
		{"ssh", TargetSSH},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := drivers[tt.target]
			if !ok {
				t.Errorf("no driver registered for %s", tt.target)
			}
		})
	}
}

func TestDeployReturnsCorrectTarget(t *testing.T) {
	tests := []struct {
		target Target
		env    map[string]string
	}{
		{TargetAWSECS, nil},
		{TargetAWSLambda, nil},
		{TargetAWSS3, nil},
		{TargetGCPCloudRun, nil},
		{TargetAzureAppService, nil},
		{TargetSSH, nil},
	}
	for _, tt := range tests {
		t.Run(string(tt.target), func(t *testing.T) {
			// These will fail due to missing env/commands,
			// but should still set the Target field correctly.
			r := Deploy(context.Background(), tt.target, ".", tt.env)
			if r.Target != tt.target {
				t.Errorf("Target = %q, want %q", r.Target, tt.target)
			}
		})
	}
}

func TestResultStruct(t *testing.T) {
	r := &Result{Target: TargetVercel, Success: true, Output: "ok", URL: "https://x.vercel.app"}
	if r.Target != TargetVercel {
		t.Errorf("Target = %q, want vercel", r.Target)
	}
	if !r.Success {
		t.Error("expected Success = true")
	}
}
