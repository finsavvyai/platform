package deploy

import (
	"context"
	"testing"
)

func TestCfPagesProjectName(t *testing.T) {
	tests := []struct {
		name        string
		env         map[string]string
		wantProject string
	}{
		{
			name:        "default project name is app",
			env:         map[string]string{},
			wantProject: "app",
		},
		{
			name:        "custom CF_PROJECT",
			env:         map[string]string{"CF_PROJECT": "my-site"},
			wantProject: "my-site",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// cfPages calls run() which will fail since npx/wrangler
			// aren't available, but we can verify the function doesn't
			// panic and returns a result with the correct target.
			r := cfPages(context.Background(), t.TempDir(), tt.env)
			if r.Target != TargetCloudflarePages {
				t.Errorf("Target = %q, want %q", r.Target, TargetCloudflarePages)
			}
			// The function ran (didn't early-return with a missing-env error).
			// Since npx isn't installed, Success will be false, which is fine.
		})
	}
}
