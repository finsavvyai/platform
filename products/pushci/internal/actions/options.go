package actions

// DefaultPlatformImages maps GitHub Actions runner labels to Docker images
// that act will boot. catthehacker images are the de-facto standard for
// running ubuntu-* runners locally and bundle the GitHub Actions toolcache.
var DefaultPlatformImages = map[string]string{
	"ubuntu-latest": "catthehacker/ubuntu:act-latest",
	"ubuntu-24.04":  "catthehacker/ubuntu:act-24.04",
	"ubuntu-22.04":  "catthehacker/ubuntu:act-22.04",
	"ubuntu-20.04":  "catthehacker/ubuntu:act-20.04",
}

// RunOptions controls a single workflow execution. Zero value is valid.
type RunOptions struct {
	// WorkflowsDir is the path to the workflows directory or a single
	// workflow file. Empty means act's default (./.github/workflows/).
	WorkflowsDir string

	// WorkingDir is the repository root that act sees as the workspace.
	WorkingDir string

	// Event is the GitHub event name (push, pull_request, schedule,
	// workflow_dispatch, ...). Empty defaults to "push".
	Event string

	// EventPayload is an optional path to a JSON event payload.
	EventPayload string

	// Job restricts execution to a single job ID. Empty means all jobs.
	Job string

	// Matrix narrows matrix expansion to specific values, e.g.
	// {"node": "20", "os": "ubuntu-latest"}.
	Matrix map[string]string

	// Secrets are passed to the workflow as encrypted-at-rest values.
	// Keys must match GitHub secret naming rules (uppercase, no spaces).
	Secrets map[string]string

	// Env adds environment variables visible to every step.
	Env map[string]string

	// Inputs are workflow_dispatch inputs.
	Inputs map[string]string

	// Platforms overrides the default runner→image mapping.
	Platforms map[string]string

	// ContainerArchitecture forces a specific arch (linux/amd64,
	// linux/arm64). Empty auto-selects linux/amd64 on Apple Silicon.
	ContainerArchitecture string

	// DryRun validates the workflow without spawning containers.
	DryRun bool

	// Verbose enables act's verbose logging.
	Verbose bool

	// Bind mounts the working directory instead of copying it. Faster for
	// dev loops, but the workflow can mutate your working tree.
	Bind bool

	// JSONLogs makes act emit one JSON object per log line. Required when
	// the caller wants structured streaming via output.go.
	JSONLogs bool

	// Reuse keeps containers between runs to maintain state.
	Reuse bool

	// LocalRepositories maps a GitHub reusable-workflow ref (the
	// `uses:` target, e.g. "acme/workflows@v1" or
	// "acme/workflows/.github/workflows/build.yml@v1") to a local
	// directory that act should use in place of cloning from github.com.
	// Forwarded to act's --local-repository flag. Useful for enterprise
	// monorepos that call reusable workflows from sibling private repos
	// and for hermetic tests that can't reach the network.
	LocalRepositories map[string]string

	// GitHubToken is a Personal Access Token act should use when it
	// fetches remote reusable workflows from a private repository. If
	// set and Secrets does not already carry GITHUB_TOKEN, the wrapper
	// adds it so `uses: org/repo/.github/workflows/foo.yml@ref` resolves
	// without leaking the token onto the command line.
	GitHubToken string
}
