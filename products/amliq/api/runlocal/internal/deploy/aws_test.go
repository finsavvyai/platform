package deploy

import (
	"context"
	"strings"
	"testing"
)

func TestAWSMissingEnvVars(t *testing.T) {
	tests := []struct {
		name    string
		fn      func(context.Context, string, map[string]string) *Result
		env     map[string]string
		wantMsg string
	}{
		{
			name:    "ECS missing cluster",
			fn:      awsECS,
			env:     map[string]string{},
			wantMsg: "AWS_ECS_CLUSTER",
		},
		{
			name:    "ECS missing service",
			fn:      awsECS,
			env:     map[string]string{"AWS_ECS_CLUSTER": "c"},
			wantMsg: "AWS_ECS_SERVICE",
		},
		{
			name:    "Lambda missing function",
			fn:      awsLambda,
			env:     map[string]string{},
			wantMsg: "AWS_LAMBDA_FUNCTION required",
		},
		{
			name:    "S3 missing bucket",
			fn:      awsS3,
			env:     map[string]string{},
			wantMsg: "AWS_S3_BUCKET required",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := tt.fn(context.Background(), t.TempDir(), tt.env)
			if r.Success {
				t.Error("expected failure result")
			}
			if !strings.Contains(r.Output, tt.wantMsg) {
				t.Errorf("Output = %q, want substring %q", r.Output, tt.wantMsg)
			}
		})
	}
}
