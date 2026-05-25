//go:build integration

package database_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/cache"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

const (
	redisImage = "redis:7-alpine"
	redisPass  = "qftest-pw"
)

func startRedis(t *testing.T, withAuth bool) (testcontainers.Container, *entities.Connection) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cmd := []string{"redis-server", "--save", "", "--appendonly", "no"}
	pass := ""
	if withAuth {
		cmd = append(cmd, "--requirepass", redisPass)
		pass = redisPass
	}
	req := testcontainers.ContainerRequest{
		Image:        redisImage,
		ExposedPorts: []string{"6379/tcp"},
		Cmd:          cmd,
		WaitingFor:   waitForLog("Ready to accept connections", 1),
	}
	c, host, port := startContainer(t, ctx, req, "6379/tcp")
	conn := newConn(entities.TypeRedis, host, port, "0", "", pass)
	return c, conn
}

func redisConnected(t *testing.T, conn *entities.Connection) *cache.RedisAdapter {
	t.Helper()
	a := cache.NewRedisAdapter(conn, testLogger()).(*cache.RedisAdapter)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	require.NoError(t, a.Connect(ctx, conn))
	require.NoError(t, a.HealthCheck(ctx))
	return a
}

func TestRedis_ConnectAndHealth(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())
	assert.True(t, a.IsConnected())
}

func TestRedis_ExecuteParameterized(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	// SET key value, GET key — value is passed as a param so the adapter
	// cannot string-concat it into the command (binding correctness).
	_, err := a.ExecuteQuery(ctx, "SET greeting", "hello-world")
	require.NoError(t, err)
	res, err := a.ExecuteQuery(ctx, "GET greeting")
	require.NoError(t, err)
	require.NotNil(t, res)
	require.GreaterOrEqual(t, len(res.Rows), 1)
}

func TestRedis_Stream1000Rows(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	for i := 0; i < 1500; i++ {
		_, err := a.ExecuteQuery(ctx, fmt.Sprintf("SET k%d v%d", i, i))
		require.NoError(t, err)
	}

	// Stream over SCAN — adapter MUST iterate via SCAN, not KEYS *, to avoid
	// blocking the server on large keyspaces.
	rowsCh, errCh := a.Stream(ctx, "SCAN k*", streamOpts(0))
	got, terr := drainStream(ctx, rowsCh, errCh)
	require.NoError(t, terr)
	assert.GreaterOrEqual(t, got, 1000, "expected at least 1000 streamed keys")
}

func TestRedis_StreamCancelMidway(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	for i := 0; i < 5000; i++ {
		_, err := a.ExecuteQuery(bgCtx, fmt.Sprintf("SET k%d v%d", i, i))
		require.NoError(t, err)
	}

	ctx, cancel := context.WithCancel(bgCtx)
	rowsCh, errCh := a.Stream(ctx, "SCAN k*", streamOpts(0))
	for i := 0; i < 3; i++ {
		<-rowsCh
	}
	cancel()
	_, terr := drainStream(bgCtx, rowsCh, errCh)
	assert.Error(t, terr)
}

func TestRedis_Timeout(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())

	ctx, cancel := shortCtx(context.Background())
	defer cancel()
	// DEBUG SLEEP blocks the server thread — adapter must surface deadline.
	_, err := a.ExecuteQuery(ctx, "DEBUG SLEEP 2")
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) ||
			strings.Contains(strings.ToLower(err.Error()), "deadline") ||
			strings.Contains(strings.ToLower(err.Error()), "timeout"),
		"expected ErrTimeout / DeadlineExceeded, got %v", err)
}

func TestRedis_AuthFail(t *testing.T) {
	c, conn := startRedis(t, true)
	defer terminate(t, c)
	bad := *conn
	bad.Password = "wrong-password"
	a := cache.NewRedisAdapter(&bad, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := a.Connect(ctx, &bad)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrAuthFail) ||
			strings.Contains(strings.ToLower(err.Error()), "auth"),
		"expected ErrAuthFail, got %v", err)
}

func TestRedis_CommandInjectionRejected(t *testing.T) {
	c, conn := startRedis(t, false)
	defer terminate(t, c)
	a := redisConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, "SET sentinel", "alive")
	require.NoError(t, err)

	// Pass a multi-command payload as a single argument — the RESP protocol
	// must transmit it as one bulk-string. The sentinel key must survive.
	payload := `value\r\nFLUSHDB\r\n`
	_, err = a.ExecuteQuery(ctx, "SET attacker", payload)
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, "GET sentinel")
	require.NoError(t, err)
	require.NotNil(t, res)
	require.GreaterOrEqual(t, len(res.Rows), 1, "sentinel key MUST still exist (no FLUSHDB injection)")
}
