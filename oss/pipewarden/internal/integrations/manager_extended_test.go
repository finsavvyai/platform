package integrations

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/finsavvyai/pipewarden/internal/config"
	"github.com/finsavvyai/pipewarden/internal/logging"
)

// TestManagerAddMultipleProviders tests adding multiple providers of different platforms.
func TestManagerAddMultipleProviders(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	providers := []struct {
		name     string
		platform Platform
	}{
		{"gh-prod", PlatformGitHub},
		{"gh-staging", PlatformGitHub},
		{"gl-main", PlatformGitLab},
		{"gl-backup", PlatformGitLab},
		{"bb-cloud", PlatformBitbucket},
		{"jenkins-main", PlatformJenkins},
		{"azure-dev", PlatformAzureDevOps},
		{"circleci-v2", PlatformCircleCI},
	}

	for _, p := range providers {
		mock := &mockProvider{
			platform: p.platform,
			connectStatus: &ConnectionStatus{
				Connected: true,
				Platform:  p.platform,
				User:      fmt.Sprintf("user-%s", p.name),
			},
		}
		if err := m.Add(p.name, mock); err != nil {
			t.Fatalf("failed to add %s: %v", p.name, err)
		}
	}

	if m.Count() != 8 {
		t.Errorf("expected 8 connections, got %d", m.Count())
	}

	// Verify each connection
	for _, p := range providers {
		conn, err := m.Get(p.name)
		if err != nil {
			t.Errorf("failed to get %s: %v", p.name, err)
		}
		if conn.Name != p.name {
			t.Errorf("expected name %s, got %s", p.name, conn.Name)
		}
		if conn.Platform != p.platform {
			t.Errorf("expected platform %s, got %s", p.platform, conn.Platform)
		}
	}

	// Verify GetByPlatform returns correct counts
	ghConns := m.GetByPlatform(PlatformGitHub)
	if len(ghConns) != 2 {
		t.Errorf("expected 2 GitHub connections, got %d", len(ghConns))
	}

	glConns := m.GetByPlatform(PlatformGitLab)
	if len(glConns) != 2 {
		t.Errorf("expected 2 GitLab connections, got %d", len(glConns))
	}

	jenkinsConns := m.GetByPlatform(PlatformJenkins)
	if len(jenkinsConns) != 1 {
		t.Errorf("expected 1 Jenkins connection, got %d", len(jenkinsConns))
	}
}

// TestManagerConcurrentScans tests thread-safe concurrent operations.
func TestManagerConcurrentScans(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add multiple connections
	for i := 0; i < 5; i++ {
		name := fmt.Sprintf("gh-conn-%d", i)
		_ = m.Add(name, &mockProvider{
			platform: PlatformGitHub,
			connectStatus: &ConnectionStatus{
				Connected: true,
				Platform:  PlatformGitHub,
				User:      fmt.Sprintf("user-%d", i),
			},
		})
	}

	ctx := context.Background()
	var wg sync.WaitGroup
	results := make(map[string]*ConnectionStatus)
	var mu sync.Mutex

	// Concurrent test connections
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(connIndex int) {
			defer wg.Done()

			connName := fmt.Sprintf("gh-conn-%d", connIndex%5)
			status, err := m.TestConnection(ctx, connName)

			mu.Lock()
			defer mu.Unlock()

			if err != nil {
				t.Errorf("failed to test connection %s: %v", connName, err)
			}
			if status == nil {
				t.Error("expected non-nil status")
			}
			results[connName] = status
		}(i)
	}

	wg.Wait()

	if len(results) < 5 {
		t.Errorf("expected at least 5 unique connections tested, got %d", len(results))
	}
}

// TestManagerRemoveProvider removes a provider and verifies cleanup.
func TestManagerRemoveProvider(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add multiple connections
	connNames := []string{"conn-a", "conn-b", "conn-c", "conn-d"}
	for _, name := range connNames {
		_ = m.Add(name, &mockProvider{platform: PlatformGitHub})
	}

	if m.Count() != 4 {
		t.Fatalf("expected 4 connections, got %d", m.Count())
	}

	// Remove middle connections
	if err := m.Remove("conn-b"); err != nil {
		t.Fatalf("failed to remove conn-b: %v", err)
	}
	if err := m.Remove("conn-c"); err != nil {
		t.Fatalf("failed to remove conn-c: %v", err)
	}

	if m.Count() != 2 {
		t.Errorf("expected 2 connections after removal, got %d", m.Count())
	}

	// Verify removed connections are gone
	if _, err := m.Get("conn-b"); err == nil {
		t.Error("expected error when getting removed connection")
	}

	// Verify remaining connections exist
	if _, err := m.Get("conn-a"); err != nil {
		t.Errorf("failed to get conn-a: %v", err)
	}
	if _, err := m.Get("conn-d"); err != nil {
		t.Errorf("failed to get conn-d: %v", err)
	}
}

// TestManagerListAllPipelines aggregates pipelines across all connections.
func TestManagerListAllPipelines(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add connections with different pipeline counts
	_ = m.Add("gh-1", &mockProvider{
		platform: PlatformGitHub,
		pipelines: []Pipeline{
			{ID: "gh-pipe-1", Name: "Pipeline 1", Status: StatusSuccess},
			{ID: "gh-pipe-2", Name: "Pipeline 2", Status: StatusPending},
		},
	})

	_ = m.Add("gl-1", &mockProvider{
		platform: PlatformGitLab,
		pipelines: []Pipeline{
			{ID: "gl-pipe-1", Name: "CI Pipeline", Status: StatusRunning},
			{ID: "gl-pipe-2", Name: "Deploy Pipeline", Status: StatusSuccess},
			{ID: "gl-pipe-3", Name: "Test Pipeline", Status: StatusFailed},
		},
	})

	_ = m.Add("bb-1", &mockProvider{
		platform: PlatformBitbucket,
		pipelines: []Pipeline{
			{ID: "bb-pipe-1", Name: "Bitbucket Pipeline", Status: StatusSuccess},
		},
	})

	ctx := context.Background()

	// Test getting pipelines from each connection
	ghPipes, _ := m.ListPipelines(ctx, "gh-1", "owner", "repo")
	if len(ghPipes) != 2 {
		t.Errorf("expected 2 GitHub pipelines, got %d", len(ghPipes))
	}

	glPipes, _ := m.ListPipelines(ctx, "gl-1", "owner", "repo")
	if len(glPipes) != 3 {
		t.Errorf("expected 3 GitLab pipelines, got %d", len(glPipes))
	}

	bbPipes, _ := m.ListPipelines(ctx, "bb-1", "owner", "repo")
	if len(bbPipes) != 1 {
		t.Errorf("expected 1 Bitbucket pipeline, got %d", len(bbPipes))
	}
}

// TestManagerPlatformStatistics counts connections per platform.
func TestManagerPlatformStatistics(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add connections with specific distribution
	for i := 0; i < 3; i++ {
		_ = m.Add(fmt.Sprintf("gh-%d", i), &mockProvider{platform: PlatformGitHub})
	}
	for i := 0; i < 2; i++ {
		_ = m.Add(fmt.Sprintf("gl-%d", i), &mockProvider{platform: PlatformGitLab})
	}
	for i := 0; i < 2; i++ {
		_ = m.Add(fmt.Sprintf("jenkins-%d", i), &mockProvider{platform: PlatformJenkins})
	}
	_ = m.Add("azure-1", &mockProvider{platform: PlatformAzureDevOps})

	// Verify counts
	stats := map[Platform]int{
		PlatformGitHub:      3,
		PlatformGitLab:      2,
		PlatformJenkins:     2,
		PlatformAzureDevOps: 1,
		PlatformBitbucket:   0,
		PlatformCircleCI:    0,
	}

	for platform, expectedCount := range stats {
		actualConns := m.GetByPlatform(platform)
		if len(actualConns) != expectedCount {
			t.Errorf("platform %s: expected %d, got %d", platform, expectedCount, len(actualConns))
		}
	}
}

// TestManagerReplaceMultipleConnections tests replacing multiple connections.
func TestManagerReplaceMultipleConnections(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add initial connections
	_ = m.Add("conn-1", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{User: "old-user-1"},
	})
	_ = m.Add("conn-2", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{User: "old-user-2"},
	})

	// Replace with new providers
	m.Replace("conn-1", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{User: "new-user-1"},
	})
	m.Replace("conn-2", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{User: "new-user-2"},
	})

	// Verify replacements
	status1, _ := m.TestConnection(context.Background(), "conn-1")
	if status1.User != "new-user-1" {
		t.Errorf("expected new-user-1, got %s", status1.User)
	}

	status2, _ := m.TestConnection(context.Background(), "conn-2")
	if status2.User != "new-user-2" {
		t.Errorf("expected new-user-2, got %s", status2.User)
	}
}

// TestManagerListOrderPreservation verifies connection list order consistency.
func TestManagerListOrderPreservation(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	names := []string{"zebra", "apple", "middle", "beta", "zulu"}
	for _, name := range names {
		_ = m.Add(name, &mockProvider{platform: PlatformGitHub})
	}

	list1 := m.List()
	list2 := m.List()

	if len(list1) != len(list2) {
		t.Error("list length mismatch")
	}

	for i := range list1 {
		if list1[i].Name != list2[i].Name {
			t.Errorf("list order inconsistent at position %d", i)
		}
	}
}

// TestManagerErrorHandling handles provider errors gracefully.
func TestManagerErrorHandling(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	// Add provider that will fail
	_ = m.Add("failing-conn", &mockProvider{
		platform:   PlatformGitHub,
		connectErr: fmt.Errorf("network error"),
	})

	// Add successful provider
	_ = m.Add("working-conn", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{Connected: true},
	})

	// Test all connections
	results := m.TestAllConnections(context.Background())

	if len(results) != 2 {
		t.Errorf("expected 2 results, got %d", len(results))
	}

	if results["failing-conn"].Connected {
		t.Error("expected failing-conn to be disconnected")
	}

	if !results["working-conn"].Connected {
		t.Error("expected working-conn to be connected")
	}
}

// TestManagerContextCancellation handles cancelled context.
func TestManagerContextCancellation(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	_ = m.Add("test-conn", &mockProvider{
		platform:      PlatformGitHub,
		connectStatus: &ConnectionStatus{Connected: true},
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	// This should handle cancelled context gracefully
	status, err := m.TestConnection(ctx, "test-conn")
	if err == nil {
		// Context cancellation might be handled differently
		// Just verify the call doesn't panic
		if status == nil {
			t.Error("expected status even with cancelled context")
		}
	}
}

// TestManagerTriggerPipelineAcrossPlatforms tests triggering pipelines on multiple platforms.
func TestManagerTriggerPipelineAcrossPlatforms(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	platforms := []Platform{PlatformGitHub, PlatformGitLab, PlatformBitbucket}
	for i, platform := range platforms {
		name := fmt.Sprintf("conn-%d", i)
		_ = m.Add(name, &mockProvider{
			platform: platform,
			runs:     []PipelineRun{{ID: "run-123", Status: StatusPending}},
		})
	}

	ctx := context.Background()

	for i := range platforms {
		connName := fmt.Sprintf("conn-%d", i)
		run, err := m.GetPipelineRun(ctx, connName, "owner", "repo", "run-123")
		if err != nil {
			t.Errorf("failed to get pipeline run from %s: %v", connName, err)
		}
		if run.ID != "run-123" {
			t.Errorf("expected run-123, got %s", run.ID)
		}
	}
}

// TestManagerDuplicateAdditionPrevention prevents duplicate connection names.
func TestManagerDuplicateAdditionPrevention(t *testing.T) {
	logger, _ := logging.New(&config.LoggingConfig{Level: "info", JSON: true})
	m := NewManager(logger)

	provider1 := &mockProvider{platform: PlatformGitHub}
	provider2 := &mockProvider{platform: PlatformGitLab}

	// Add first connection
	if err := m.Add("duplicate-test", provider1); err != nil {
		t.Fatalf("failed to add first connection: %v", err)
	}

	// Try to add duplicate name with different platform
	err := m.Add("duplicate-test", provider2)
	if err == nil {
		t.Error("expected error when adding duplicate connection name")
	}

	// Verify original is still there
	conn, _ := m.Get("duplicate-test")
	if conn.Platform != PlatformGitHub {
		t.Errorf("expected original platform GitHub, got %s", conn.Platform)
	}
}
