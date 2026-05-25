//go:build integration

package database_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

const (
	pgImage    = "postgres:16-alpine"
	pgUser     = "qftest"
	pgPass     = "qftest-pw"
	pgDatabase = "qfdb"
)

func startPostgres(t *testing.T) (testcontainers.Container, *entities.Connection) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req := testcontainers.ContainerRequest{
		Image:        pgImage,
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_USER":     pgUser,
			"POSTGRES_PASSWORD": pgPass,
			"POSTGRES_DB":       pgDatabase,
		},
		WaitingFor: waitForLog("database system is ready to accept connections", 2),
	}
	c, host, port := startContainer(t, ctx, req, "5432/tcp")
	return c, newConn(entities.TypePostgreSQL, host, port, pgDatabase, pgUser, pgPass)
}

func pgConnected(t *testing.T, conn *entities.Connection) *sql.PostgreSQLAdapter {
	t.Helper()
	a := sql.NewPostgreSQLAdapter(conn, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	require.NoError(t, a.Connect(ctx, conn))
	require.NoError(t, a.HealthCheck(ctx))
	return a
}

func TestPostgres_ConnectAndHealth(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())
	assert.True(t, a.IsConnected())
}

func TestPostgres_ExecuteParameterized(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE t (id int primary key, name text)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO t VALUES ($1,$2),($3,$4)`, 1, "alice", 2, "bob")
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, `SELECT id, name FROM t WHERE id = $1`, 1)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Len(t, res.Rows, 1)
	assert.Equal(t, "alice", res.Rows[0]["name"])
}

func TestPostgres_Stream1000Rows(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE big (id int)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO big SELECT generate_series(1,1500)`)
	require.NoError(t, err)

	rowsCh, errCh := a.Stream(ctx, `SELECT id FROM big ORDER BY id`, streamOpts(0))
	got, terr := drainStream(ctx, rowsCh, errCh)
	require.NoError(t, terr)
	assert.GreaterOrEqual(t, got, 1000, "expected at least 1000 streamed rows")
}

func TestPostgres_StreamCancelMidway(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	_, err := a.ExecuteQuery(bgCtx, `CREATE TABLE big (id int)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(bgCtx, `INSERT INTO big SELECT generate_series(1,5000)`)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(bgCtx)
	rowsCh, errCh := a.Stream(ctx, `SELECT id FROM big ORDER BY id`, streamOpts(0))
	// read a few then cancel
	for i := 0; i < 3; i++ {
		<-rowsCh
	}
	cancel()
	_, terr := drainStream(bgCtx, rowsCh, errCh)
	// expect context cancellation surfaced
	assert.Error(t, terr)
}

func TestPostgres_Timeout(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())

	ctx, cancel := shortCtx(context.Background())
	defer cancel()
	_, err := a.ExecuteQuery(ctx, `SELECT pg_sleep(2)`)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrTimeout) || errors.Is(err, context.DeadlineExceeded),
		"expected ErrTimeout or DeadlineExceeded, got %v", err)
}

func TestPostgres_AuthFail(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	bad := *conn
	bad.Password = "wrong-password"
	a := sql.NewPostgreSQLAdapter(&bad, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := a.Connect(ctx, &bad)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrAuthFail) || strings.Contains(err.Error(), "authentication"),
		"expected ErrAuthFail, got %v", err)
}

func TestPostgres_SQLInjectionRejected(t *testing.T) {
	c, conn := startPostgres(t)
	defer terminate(t, c)
	a := pgConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE victims (id int, name text)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO victims VALUES (1,'safe')`)
	require.NoError(t, err)

	// Param value contains an injection payload. Param binding must treat it as
	// literal text — the table must still exist after.
	payload := `'; DROP TABLE victims; --`
	_, err = a.ExecuteQuery(ctx, `SELECT * FROM victims WHERE name = $1`, payload)
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, `SELECT count(*) AS n FROM victims`)
	require.NoError(t, err)
	require.Len(t, res.Rows, 1)
	assert.NotNil(t, res.Rows[0]["n"], "victims table must still exist after injection attempt")
}

