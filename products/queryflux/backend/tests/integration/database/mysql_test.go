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
	mysqlImage = "mysql:8.0"
	mysqlUser  = "qftest"
	mysqlPass  = "qftest-pw"
	mysqlDB    = "qfdb"
	mysqlRoot  = "qftest-root"
)

func startMySQL(t *testing.T) (testcontainers.Container, *entities.Connection) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	req := testcontainers.ContainerRequest{
		Image:        mysqlImage,
		ExposedPorts: []string{"3306/tcp"},
		Env: map[string]string{
			"MYSQL_ROOT_PASSWORD": mysqlRoot,
			"MYSQL_USER":          mysqlUser,
			"MYSQL_PASSWORD":      mysqlPass,
			"MYSQL_DATABASE":      mysqlDB,
		},
		WaitingFor: waitForLog("ready for connections", 2),
	}
	c, host, port := startContainer(t, ctx, req, "3306/tcp")
	return c, newConn(entities.TypeMySQL, host, port, mysqlDB, mysqlUser, mysqlPass)
}

func mysqlConnected(t *testing.T, conn *entities.Connection) *sql.MySQLAdapter {
	t.Helper()
	a := sql.NewMySQLAdapter(conn, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	require.NoError(t, a.Connect(ctx, conn))
	require.NoError(t, a.HealthCheck(ctx))
	return a
}

func TestMySQL_ConnectAndHealth(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())
	assert.True(t, a.IsConnected())
}

func TestMySQL_ExecuteParameterized(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE t (id INT PRIMARY KEY, name VARCHAR(64))`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, `INSERT INTO t VALUES (?,?),(?,?)`, 1, "alice", 2, "bob")
	require.NoError(t, err)

	res, err := a.ExecuteQuery(ctx, `SELECT id, name FROM t WHERE id = ?`, 1)
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Len(t, res.Rows, 1)
	assert.Equal(t, "alice", res.Rows[0]["name"])
}

func TestMySQL_Stream1000Rows(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE big (id INT)`)
	require.NoError(t, err)
	// MySQL has no generate_series; bulk insert via recursive CTE (8.0+).
	_, err = a.ExecuteQuery(ctx, `
		INSERT INTO big (id)
		WITH RECURSIVE seq(n) AS (
			SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 1500
		)
		SELECT n FROM seq`)
	require.NoError(t, err)

	rowsCh, errCh := a.Stream(ctx, `SELECT id FROM big ORDER BY id`, streamOpts(0))
	got, terr := drainStream(ctx, rowsCh, errCh)
	require.NoError(t, terr)
	assert.GreaterOrEqual(t, got, 1000, "expected at least 1000 streamed rows")
}

func TestMySQL_StreamCancelMidway(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	_, err := a.ExecuteQuery(bgCtx, `CREATE TABLE big (id INT)`)
	require.NoError(t, err)
	_, err = a.ExecuteQuery(bgCtx, `
		INSERT INTO big (id)
		WITH RECURSIVE seq(n) AS (
			SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < 5000
		)
		SELECT n FROM seq`)
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

func TestMySQL_Timeout(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())

	ctx, cancel := shortCtx(context.Background())
	defer cancel()
	_, err := a.ExecuteQuery(ctx, `SELECT SLEEP(2)`)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrTimeout) || errors.Is(err, context.DeadlineExceeded),
		"expected ErrTimeout or DeadlineExceeded, got %v", err)
}

func TestMySQL_AuthFail(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	bad := *conn
	bad.Password = "wrong-password"
	a := sql.NewMySQLAdapter(&bad, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := a.Connect(ctx, &bad)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrAuthFail) || strings.Contains(strings.ToLower(err.Error()), "access denied"),
		"expected ErrAuthFail, got %v", err)
}

func TestMySQL_SQLInjectionRejected(t *testing.T) {
	c, conn := startMySQL(t)
	defer terminate(t, c)
	a := mysqlConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, `CREATE TABLE victims (id INT, name VARCHAR(64))`)
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
