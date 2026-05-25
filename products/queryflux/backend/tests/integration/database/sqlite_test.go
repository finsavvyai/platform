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

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// newSQLiteConn returns a Connection pointed at an in-memory SQLite database.
// Each test gets a fresh DB — the empty Database field is interpreted as
// `:memory:` by getSQLiteConnectionString.
func newSQLiteConn() *entities.Connection {
	c := newConn(entities.TypeSQLite, "localhost", 0, "", "u", "")
	c.Database = ""
	return c
}

func sqliteConnected(t *testing.T) *sql.SQLiteAdapter {
	t.Helper()
	conn := newSQLiteConn()
	a := sql.NewSQLiteAdapter(conn, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, a.Connect(ctx, conn))
	require.NoError(t, a.HealthCheck(ctx))
	return a
}

func TestSQLite_ConnectAndHealth(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	assert.True(t, a.IsConnected())
}

func TestSQLite_ExecuteParameterized(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO t VALUES (?,?),(?,?)`, 1, "alice", 2, "bob")
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, `SELECT id, name FROM t WHERE id = ?`, 1)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Len(t, res.Rows, 1)
	assert.Equal(t, "alice", res.Rows[0]["name"])
}

func TestSQLite_Stream1000Rows(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE big (id INTEGER)`)
	require.NoError(t, err)
	// SQLite supports recursive CTE for bulk insert.
	_, err = a.ExecuteQuery(ctx, `
		WITH RECURSIVE seq(n) AS (
			SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 1500
		)
		INSERT INTO big SELECT n FROM seq`)
	require.NoError(t, err)

	rowsCh, errCh := a.Stream(ctx, `SELECT id FROM big ORDER BY id`, streamOpts(0))
	got, terr := drainStream(ctx, rowsCh, errCh)
	require.NoError(t, terr)
	assert.GreaterOrEqual(t, got, 1000, "expected at least 1000 streamed rows")
}

func TestSQLite_StreamCancelMidway(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	_, err := a.ExecuteQuery(bgCtx, `CREATE TABLE big (id INTEGER)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(bgCtx, `
		WITH RECURSIVE seq(n) AS (
			SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 5000
		)
		INSERT INTO big SELECT n FROM seq`)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(bgCtx)
	rowsCh, errCh := a.Stream(ctx, `SELECT id FROM big ORDER BY id`, streamOpts(0))
	for i := 0; i < 3; i++ {
		<-rowsCh
	}
	cancel()
	_, terr := drainStream(bgCtx, rowsCh, errCh)
	assert.Error(t, terr)
}

func TestSQLite_Timeout(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	// Build a heavy CROSS JOIN that always blows past 100ms on modest CPUs.
	_, err := a.ExecuteQuery(bgCtx, `CREATE TABLE big (id INTEGER)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(bgCtx, `
		WITH RECURSIVE seq(n) AS (
			SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 5000
		)
		INSERT INTO big SELECT n FROM seq`)
	require.NoError(t, err)

	ctx, cancel := shortCtx(bgCtx)
	defer cancel()
	_, err = a.ExecuteQuery(ctx, `SELECT count(*) FROM big a, big b, big c`)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) ||
			strings.Contains(strings.ToLower(err.Error()), "interrupt") ||
			strings.Contains(strings.ToLower(err.Error()), "deadline"),
		"expected ErrTimeout / DeadlineExceeded, got %v", err)
}

func TestSQLite_AuthFail(t *testing.T) {
	// SQLite (file/memory) has no network auth. The contract requires
	// AuthFail-style rejection for a credentialed driver; we instead assert
	// that opening a clearly-invalid DB path returns a connection-class
	// error wrapping ErrConnection (per QUERY_CONTRACT §3 mapping).
	conn := newConn(entities.TypeSQLite, "localhost", 0, "/no/such/dir/forbidden.db", "u", "")
	a := sql.NewSQLiteAdapter(conn, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := a.Connect(ctx, conn)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrConnection) || errors.Is(err, types.ErrAuthFail) ||
			strings.Contains(strings.ToLower(err.Error()), "unable to open") ||
			strings.Contains(strings.ToLower(err.Error()), "no such"),
		"expected connection-class error, got %v", err)
}

func TestSQLite_SQLInjectionRejected(t *testing.T) {
	a := sqliteConnected(t)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE victims (id INTEGER, name TEXT)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO victims VALUES (1,'safe')`)
	require.NoError(t, err)

	payload := `'; DROP TABLE victims; --`
	_, err = a.ExecuteQuery(ctx, `SELECT * FROM victims WHERE name = ?`, payload)
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, `SELECT COUNT(*) AS n FROM victims`)
	require.NoError(t, err)
	require.Len(t, res.Rows, 1)
	assert.NotNil(t, res.Rows[0]["n"], "victims table must still exist after injection attempt")
}
