//go:build integration

// Package database_test contains integration tests for QueryFlux DB adapters.
// These tests are gated behind the `integration` build tag and require Docker
// to spin up real database containers via testcontainers-go. SQLite tests use
// an in-memory database and do NOT require Docker.
//
// Run with:
//
//	cd backend && go test -tags=integration ./tests/integration/database/...
package database_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/docker/go-connections/nat"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// testLogger returns a logger that stays quiet during tests.
func testLogger() *logrus.Logger {
	l := logrus.New()
	l.SetLevel(logrus.WarnLevel)
	return l
}

// startContainer spins up a generic testcontainer with the supplied request and
// returns the container plus the mapped host:port. Caller must call terminate.
//
// On failure (Docker unavailable, image pull error, etc.) the calling test is
// FAILED — not skipped — so CI surfaces missing prerequisites loudly.
func startContainer(t *testing.T, ctx context.Context, req testcontainers.ContainerRequest, port string) (testcontainers.Container, string, int) {
	t.Helper()
	c, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	require.NoError(t, err, "failed to start %s container", req.Image)
	host, err := c.Host(ctx)
	require.NoError(t, err, "failed to resolve container host")
	mapped, err := c.MappedPort(ctx, nat.Port(port))
	require.NoError(t, err, "failed to map container port %s", port)
	return c, host, mapped.Int()
}

// terminate stops & removes a container with a 30s budget.
func terminate(t *testing.T, c testcontainers.Container) {
	t.Helper()
	if c == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := c.Terminate(ctx); err != nil {
		t.Logf("container terminate warning: %v", err)
	}
}

// waitForLog returns a wait.Strategy that listens for msg in stdout/stderr.
func waitForLog(msg string, occurrences int) wait.Strategy {
	return wait.ForLog(msg).
		WithOccurrence(occurrences).
		WithStartupTimeout(90 * time.Second)
}

// waitForPort returns a wait.Strategy that polls a TCP port until reachable.
func waitForPort(port string) wait.Strategy {
	return wait.ForListeningPort(nat.Port(port)).
		WithStartupTimeout(90 * time.Second)
}

// newConn builds a *entities.Connection for the requested DB type.
func newConn(dbType, host string, port int, db, user, pass string) *entities.Connection {
	return &entities.Connection{
		ID:       "test-conn",
		UserID:   "test-user",
		Name:     "test-" + dbType,
		Type:     dbType,
		Host:     host,
		Port:     port,
		Database: db,
		Username: user,
		Password: pass,
		Options:  map[string]string{},
		Status:   entities.StatusActive,
	}
}

// streamOpts returns canonical Phase 1 StreamOptions per QUERY_CONTRACT.md.
func streamOpts(maxRows int64) types.StreamOptions {
	return types.StreamOptions{
		MaxRows:    maxRows,
		BatchSize:  500,
		BufferSize: 256,
	}
}

// drainStream consumes a Stream channel pair until errCh closes or ctx expires.
// Returns the number of rows received and the terminal error (nil on success).
func drainStream(ctx context.Context, rowsCh <-chan types.StreamRow, errCh <-chan error) (int, error) {
	count := 0
	var termErr error
	rowsOpen, errOpen := true, true
	for rowsOpen || errOpen {
		select {
		case _, ok := <-rowsCh:
			if !ok {
				rowsOpen = false
				continue
			}
			count++
		case e, ok := <-errCh:
			if !ok {
				errOpen = false
				continue
			}
			termErr = e
		case <-ctx.Done():
			return count, fmt.Errorf("drainStream ctx expired: %w", ctx.Err())
		}
	}
	return count, termErr
}

// shortCtx returns a 100ms deadline ctx — used by Timeout test cases.
func shortCtx(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, 100*time.Millisecond)
}
