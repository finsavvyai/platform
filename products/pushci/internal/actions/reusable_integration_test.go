//go:build integration

package actions

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestIntegration_ReusableLocal verifies act resolves a local reusable
// workflow (uses: ./.github/workflows/foo.yml) without any extra flags.
func TestIntegration_ReusableLocal(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "06-reusable-local-caller.yml", map[string]string{
		".github/workflows/06-reusable-local-callee.yml": mustReadFixture(t, "06-reusable-local-callee.yml"),
	})
	out, _ := runIntegration(t, repo, RunOptions{
		Secrets: map[string]string{"MY_TOKEN": "inherited-secret-xyz"},
	})
	if !strings.Contains(out, "Greeting: Hello, PushCI!") {
		t.Errorf("expected greeting from reusable callee\n--- output ---\n%s", out)
	}
}

// TestIntegration_ReusableRemoteViaLocalRepo verifies we can resolve a
// `uses: org/repo/.github/workflows/foo.yml@ref` by redirecting it to a
// local directory via --local-repository. This is the exact mechanism
// enterprise users rely on when their reusable workflows live in a
// private sibling repo.
func TestIntegration_ReusableRemoteViaLocalRepo(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "07-reusable-remote-caller.yml", nil)

	mockPath, err := filepath.Abs(filepath.Join("testdata", "remote-mock", "shared-workflows"))
	if err != nil {
		t.Fatal(err)
	}
	out, _ := runIntegration(t, repo, RunOptions{
		LocalRepositories: map[string]string{
			"acme-enterprise/shared-workflows@v1": mockPath,
		},
	})
	if !strings.Contains(out, "Remote reusable built: pushci") {
		t.Errorf("expected remote reusable to resolve via --local-repository\n--- output ---\n%s", out)
	}
}

// TestIntegration_ReusableNestedChain verifies act follows a caller →
// middle → leaf chain, passing inputs through each hop.
func TestIntegration_ReusableNestedChain(t *testing.T) {
	requireRuntime(t)
	repo := stageWorkflow(t, "08-reusable-nested-caller.yml", map[string]string{
		".github/workflows/08-reusable-nested-middle.yml": mustReadFixture(t, "08-reusable-nested-middle.yml"),
		".github/workflows/08-reusable-nested-leaf.yml":   mustReadFixture(t, "08-reusable-nested-leaf.yml"),
	})
	out, _ := runIntegration(t, repo, RunOptions{})
	if !strings.Contains(out, "Nested chain depth: top>middle>leaf") {
		t.Errorf("expected full chain traversal, got\n%s", out)
	}
}
