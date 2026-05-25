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
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

const (
	mongoImage = "mongo:7.0"
	mongoUser  = "qftest"
	mongoPass  = "qftest-pw"
	mongoDB    = "qfdb"
)

func startMongo(t *testing.T) (testcontainers.Container, *entities.Connection) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req := testcontainers.ContainerRequest{
		Image:        mongoImage,
		ExposedPorts: []string{"27017/tcp"},
		Env: map[string]string{
			"MONGO_INITDB_ROOT_USERNAME": mongoUser,
			"MONGO_INITDB_ROOT_PASSWORD": mongoPass,
			"MONGO_INITDB_DATABASE":      mongoDB,
		},
		WaitingFor: waitForLog("Waiting for connections", 1),
	}
	c, host, port := startContainer(t, ctx, req, "27017/tcp")
	return c, newConn(entities.TypeMongoDB, host, port, mongoDB, mongoUser, mongoPass)
}

func mongoConnected(t *testing.T, conn *entities.Connection) *nosql.MongoDBAdapter {
	t.Helper()
	a := nosql.NewMongoDBAdapter(conn, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	require.NoError(t, a.Connect(ctx, conn))
	require.NoError(t, a.HealthCheck(ctx))
	return a
}

func mongoFind(coll string, filter string) string {
	return fmt.Sprintf(`{"type":"find","collection":%q,"filter":%s}`, coll, filter)
}

func mongoInsert(coll string, doc string) string {
	return fmt.Sprintf(`{"type":"insert","collection":%q,"document":%s}`, coll, doc)
}

func TestMongo_ConnectAndHealth(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())
	assert.True(t, a.IsConnected())
}

func TestMongo_ExecuteParameterized(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, mongoInsert("users", `{"id":1,"name":"alice"}`))
	require.NoError(t, err)
	_, err = a.ExecuteQuery(ctx, mongoInsert("users", `{"id":2,"name":"bob"}`))
	require.NoError(t, err)

	// Filter binding — MongoDB uses BSON filters as params (positional binding
	// is N/A); the adapter MUST escape values inside the filter document.
	res, err := a.ExecuteQuery(ctx, mongoFind("users", `{"id":1}`))
	require.NoError(t, err)
	require.NotNil(t, res)
	require.Len(t, res.Rows, 1)
	assert.Equal(t, "alice", res.Rows[0]["name"])
}

func TestMongo_Stream1000Rows(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	for i := 0; i < 1500; i++ {
		_, err := a.ExecuteQuery(ctx, mongoInsert("big", fmt.Sprintf(`{"i":%d}`, i)))
		require.NoError(t, err)
	}

	rowsCh, errCh := a.Stream(ctx, mongoFind("big", `{}`), streamOpts(0))
	got, terr := drainStream(ctx, rowsCh, errCh)
	require.NoError(t, terr)
	assert.GreaterOrEqual(t, got, 1000, "expected at least 1000 streamed rows")
}

func TestMongo_StreamCancelMidway(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())
	bgCtx := context.Background()

	for i := 0; i < 3000; i++ {
		_, err := a.ExecuteQuery(bgCtx, mongoInsert("big", fmt.Sprintf(`{"i":%d}`, i)))
		require.NoError(t, err)
	}

	ctx, cancel := context.WithCancel(bgCtx)
	rowsCh, errCh := a.Stream(ctx, mongoFind("big", `{}`), streamOpts(0))
	for i := 0; i < 3; i++ {
		<-rowsCh
	}
	cancel()
	_, terr := drainStream(bgCtx, rowsCh, errCh)
	assert.Error(t, terr)
}

func TestMongo_Timeout(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())

	ctx, cancel := shortCtx(context.Background())
	defer cancel()
	// $function executes server-side JS — sleep deliberately exceeds 100ms.
	q := `{"type":"aggregate","collection":"users","pipeline":[{"$match":{"$expr":{"$function":{"body":"function(){var s=Date.now();while(Date.now()-s<2000){}return true;}","args":[],"lang":"js"}}}}]}`
	_, err := a.ExecuteQuery(ctx, q)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrTimeout) || errors.Is(err, context.DeadlineExceeded) ||
			strings.Contains(strings.ToLower(err.Error()), "context") ||
			strings.Contains(strings.ToLower(err.Error()), "deadline"),
		"expected ErrTimeout / DeadlineExceeded, got %v", err)
}

func TestMongo_AuthFail(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	bad := *conn
	bad.Password = "wrong-password"
	a := nosql.NewMongoDBAdapter(&bad, testLogger())
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	err := a.Connect(ctx, &bad)
	require.Error(t, err)
	assert.True(t,
		errors.Is(err, types.ErrAuthFail) ||
			strings.Contains(strings.ToLower(err.Error()), "authentication") ||
			strings.Contains(strings.ToLower(err.Error()), "auth"),
		"expected ErrAuthFail, got %v", err)
}

func TestMongo_SQLInjectionRejected(t *testing.T) {
	c, conn := startMongo(t)
	defer terminate(t, c)
	a := mongoConnected(t, conn)
	defer a.Disconnect(context.Background())
	ctx := context.Background()

	_, err := a.ExecuteQuery(ctx, mongoInsert("victims", `{"name":"safe"}`))
	require.NoError(t, err)

	// Treat injection payload as a literal string in a filter. The adapter
	// MUST serialize via BSON — the malicious payload cannot escape to a
	// shell command. Note: Mongo doesn't have SQL but operator injection is
	// the analogue. A string value must NEVER be interpreted as a $where.
	payload := `'; db.victims.drop(); //`
	res, err := a.ExecuteQuery(ctx, mongoFind("victims",
		fmt.Sprintf(`{"name":%q}`, payload)))
	require.NoError(t, err)
	assert.Empty(t, res.Rows, "filter must NOT match the safe doc when name is the payload literal")

	// victims collection must still hold the safe doc.
	all, err := a.ExecuteQuery(ctx, mongoFind("victims", `{}`))
	require.NoError(t, err)
	require.Len(t, all.Rows, 1)
}
