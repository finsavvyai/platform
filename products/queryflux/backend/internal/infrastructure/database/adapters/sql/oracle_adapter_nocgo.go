//go:build !cgo

package sql

import (
	"context"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
)

// OracleAdapter is a no-CGO placeholder. The godror driver requires CGO, while
// the production build target is static, so Oracle support is explicit opt-in.
type OracleAdapter struct {
	conn   *entities.Connection
	logger *logrus.Logger
}

func (o *OracleAdapter) unsupported() error {
	if o.logger != nil {
		o.logger.Warn("Oracle adapter requested in a no-CGO build")
	}
	return &types.AdapterError{
		Code:    "ORACLE_REQUIRES_CGO",
		Message: "Oracle connections require a CGO-enabled backend build",
	}
}

func (o *OracleAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	o.conn = conn
	return o.unsupported()
}

func (o *OracleAdapter) Disconnect(ctx context.Context) error {
	return nil
}

func (o *OracleAdapter) Shutdown(ctx context.Context) error {
	return o.Disconnect(ctx)
}

func (o *OracleAdapter) Ping(ctx context.Context) error {
	return o.unsupported()
}

func (o *OracleAdapter) HealthCheck(ctx context.Context) error {
	return o.unsupported()
}

func (o *OracleAdapter) TestConnection(ctx context.Context) error {
	return o.unsupported()
}

func (o *OracleAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	return nil, o.unsupported()
}

func (o *OracleAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return nil, o.unsupported()
}

func (o *OracleAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	return nil, o.unsupported()
}

func (o *OracleAdapter) GetColumns(ctx context.Context, tableName string) ([]types.ColumnInfo, error) {
	return nil, o.unsupported()
}

func (o *OracleAdapter) BeginTransaction(ctx context.Context) (types.Transaction, error) {
	return nil, fmt.Errorf("oracle transactions require a CGO-enabled backend build")
}

func (o *OracleAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	return &types.ConnectionMetrics{
		LastUpdated: time.Now(),
		DatabaseInfo: types.DatabaseInfo{
			Engine: "oracle",
		},
	}, nil
}

func (o *OracleAdapter) IsConnected() bool {
	return false
}

func (o *OracleAdapter) GetConnectionInfo() *entities.Connection {
	return o.conn
}
