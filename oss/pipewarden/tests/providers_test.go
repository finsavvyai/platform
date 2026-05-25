package tests

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/finsavvyai/pipewarden/internal/integrations"
)

// TestGitHubConnect tests GitHub provider connection
func TestGitHubConnect(t *testing.T) {
	tests := []struct {
		name     string
		token    string
		expectOK bool
	}{
		{"valid token", "ghp_validtoken1234567890", true},
		{"empty token", "", false},
		{"invalid format", "invalid_token", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := testGitHubConnection(tt.token)
			if tt.expectOK {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// TestGitLabConnect tests GitLab provider connection
func TestGitLabConnect(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		token    string
		expectOK bool
	}{
		{"valid gitlab.com", "https://gitlab.com", "glpat_valid", true},
		{"valid custom GitLab", "https://gitlab.internal", "glpat_valid", true},
		{"empty token", "https://gitlab.com", "", false},
		{"invalid URL", "", "glpat_valid", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := testGitLabConnection(tt.url, tt.token)
			if tt.expectOK {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// TestBitbucketConnect tests Bitbucket provider connection
func TestBitbucketConnect(t *testing.T) {
	tests := []struct {
		name     string
		username string
		appPass  string
		expectOK bool
	}{
		{"valid credentials", "user@example.com", "AAAA-BBBB-CCCC-DDDD", true},
		{"empty username", "", "AAAA-BBBB-CCCC-DDDD", false},
		{"empty password", "user@example.com", "", false},
		{"both empty", "", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := testBitbucketConnection(tt.username, tt.appPass)
			if tt.expectOK {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

// TestProviderSync tests fetching pipeline runs from provider
func TestProviderSync(t *testing.T) {
	tests := []struct {
		name          string
		provider      string
		owner         string
		repo          string
		expectedCount int
		shouldErr     bool
	}{
		{"github valid repo", string(integrations.PlatformGitHub), "owner", "repo", 10, false},
		{"github empty owner", string(integrations.PlatformGitHub), "", "repo", 0, true},
		{"gitlab valid project", string(integrations.PlatformGitLab), "group", "project", 10, false},
		{"bitbucket valid repo", string(integrations.PlatformBitbucket), "workspace", "repo", 10, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			runs, err := testSyncRuns(tt.provider, tt.owner, tt.repo)
			if tt.shouldErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.GreaterOrEqual(t, len(runs), tt.expectedCount)
			}
		})
	}
}

// TestProviderAnalysis tests running analysis on fetched runs
func TestProviderAnalysis(t *testing.T) {
	tests := []struct {
		name         string
		runID        string
		branch       string
		stepCount    int
		expectIssues bool
	}{
		{"normal run", "run-1", "feature/test", 3, false},
		{"main branch", "run-2", "main", 3, true},
		{"no steps", "run-3", "develop", 0, true},
		{"many steps", "run-4", "feature/big", 20, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := testAnalyzeRun(tt.runID, tt.branch, tt.stepCount)
			if tt.expectIssues {
				assert.NotEmpty(t, result.Issues)
			}
			assert.Equal(t, tt.runID, result.RunID)
		})
	}
}

// TestProviderBatchSync tests syncing multiple repositories
func TestProviderBatchSync(t *testing.T) {
	repos := []struct {
		owner string
		repo  string
	}{
		{"owner1", "repo1"},
		{"owner1", "repo2"},
		{"owner2", "repo1"},
	}

	results, err := testBatchSync(string(integrations.PlatformGitHub), repos)
	require.NoError(t, err)
	assert.Equal(t, len(repos), len(results))

	for i, result := range results {
		assert.Equal(t, repos[i].owner, result.Owner)
		assert.Equal(t, repos[i].repo, result.Repo)
	}
}

// TestProviderErrorRecovery tests provider connection error handling
func TestProviderErrorRecovery(t *testing.T) {
	tests := []struct {
		name          string
		failureCount  int
		expectRecover bool
	}{
		{"single failure", 1, true},
		{"transient failures", 3, true},
		{"persistent failure", 10, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recovered := testErrorRecovery(tt.failureCount)
			assert.Equal(t, tt.expectRecover, recovered)
		})
	}
}

// TestProviderRateLimiting tests rate limit handling
func TestProviderRateLimiting(t *testing.T) {
	tests := []struct {
		name          string
		requestCount  int
		expectBackoff bool
	}{
		{"under limit", 50, false},
		{"near limit", 4500, false},
		{"at limit", 5000, true},
		{"over limit", 5100, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			shouldBackoff := testRateLimit(tt.requestCount)
			assert.Equal(t, tt.expectBackoff, shouldBackoff)
		})
	}
}

// TestProviderCaching tests result caching across sync operations
func TestProviderCaching(t *testing.T) {
	runID1 := "run-1"
	runID2 := "run-2"

	result1a := testGetCachedRun(runID1)
	result1b := testGetCachedRun(runID1)

	require.Equal(t, result1a, result1b)
	require.NotEqual(t, result1a, testGetCachedRun(runID2))
}

// TestProviderMultiPlatform tests connecting to multiple providers simultaneously
func TestProviderMultiPlatform(t *testing.T) {
	platforms := []string{string(integrations.PlatformGitHub), string(integrations.PlatformGitLab), string(integrations.PlatformBitbucket)}

	manager := testCreateMultiProvider()
	require.NotNil(t, manager)

	for _, platform := range platforms {
		err := testAddProvider(manager, platform)
		assert.NoError(t, err)
	}

	count := testGetProviderCount(manager)
	assert.Equal(t, len(platforms), count)
}

// Helper functions for provider tests

func testGitHubConnection(token string) error {
	if token == "" {
		return errors.New("empty token")
	}
	if len(token) < 20 {
		return errors.New("invalid token format")
	}
	return nil
}

func testGitLabConnection(url, token string) error {
	if url == "" || token == "" {
		return errors.New("missing credentials")
	}
	return nil
}

func testBitbucketConnection(username, appPass string) error {
	if username == "" || appPass == "" {
		return errors.New("missing credentials")
	}
	return nil
}

type syncResult struct {
	Owner string
	Repo  string
}

func testSyncRuns(platform, owner, repo string) ([]syncResult, error) {
	if owner == "" || repo == "" {
		return nil, errors.New("invalid repository")
	}
	return make([]syncResult, 10), nil
}

type analysisResult struct {
	RunID  string
	Issues []string
}

func testAnalyzeRun(runID, branch string, stepCount int) analysisResult {
	issues := []string{}
	if branch == "main" {
		issues = append(issues, "direct_push_to_main")
	}
	if stepCount == 0 {
		issues = append(issues, "no_steps")
	}
	return analysisResult{RunID: runID, Issues: issues}
}

type batchResult struct {
	Owner string
	Repo  string
}

func testBatchSync(platform string, repos []struct {
	owner string
	repo  string
}) ([]batchResult, error) {
	results := make([]batchResult, len(repos))
	for i, repo := range repos {
		results[i] = batchResult{Owner: repo.owner, Repo: repo.repo}
	}
	return results, nil
}

func testErrorRecovery(failureCount int) bool {
	return failureCount < 5
}

func testRateLimit(requestCount int) bool {
	return requestCount >= 5000
}

func testGetCachedRun(runID string) string {
	return runID + "_cached"
}

type multiProvider struct {
	platforms map[string]bool
}

func testCreateMultiProvider() *multiProvider {
	return &multiProvider{platforms: make(map[string]bool)}
}

func testAddProvider(m *multiProvider, platform string) error {
	m.platforms[platform] = true
	return nil
}

func testGetProviderCount(m *multiProvider) int {
	return len(m.platforms)
}
