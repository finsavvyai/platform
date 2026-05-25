package timeseries_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/timeseries"

	"github.com/stretchr/testify/assert"
)

func TestInfluxDBAdapter_NewInfluxDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

func TestInfluxDBAdapter_Connect_InvalidHost(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "invalid-host",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Connect(ctx, conn)
	assert.Error(t, err)
	assert.False(t, adapter.IsConnected())
}

func TestInfluxDBAdapter_TestConnection_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	err := adapter.TestConnection(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestInfluxDBAdapter_ExecuteQuery_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, `from(bucket: "test_bucket") |> range(start: -1h)`)
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestInfluxDBAdapter_ExecuteQuery_EmptyQuery(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	result, err := adapter.ExecuteQuery(ctx, "")
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "Query cannot be empty")
}

func TestInfluxDBAdapter_GetSchema_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	schema, err := adapter.GetSchema(ctx)
	assert.Error(t, err)
	assert.Nil(t, schema)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestInfluxDBAdapter_GetTableInfo_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	tableInfo, err := adapter.GetTableInfo(ctx, "test_measurement")
	assert.Error(t, err)
	assert.Nil(t, tableInfo)
	assert.Contains(t, err.Error(), "Not connected")
}

func TestInfluxDBAdapter_Disconnect_NotConnected(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test InfluxDB",
		Type:     entities.TypeInfluxDB,
		Host:     "localhost",
		Port:     8086,
		Database: "test_bucket",
		Username: "",
		Password: "test-token",
		Options: map[string]string{
			"organization": "test-org",
		},
	}

	adapter := timeseries.NewInfluxDBAdapter(conn)
	ctx := context.Background()

	err := adapter.Disconnect(ctx)
	assert.NoError(t, err)
	assert.False(t, adapter.IsConnected())
}