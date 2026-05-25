package base

import (
	"context"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockPoolableAdapter is a mock implementation of PoolableAdapter
type MockPoolableAdapter struct {
	mock.Mock
}

func (m *MockPoolableAdapter) Connect(ctx context.Context, conn *entities.Connection) error {
	args := m.Called(ctx, conn)
	return args.Error(0)
}

func (m *MockPoolableAdapter) Disconnect(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockPoolableAdapter) TestConnection(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func (m *MockPoolableAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	args := m.Called(ctx, query, params)
	return args.Get(0).(*types.QueryResult), args.Error(1)
}

func (m *MockPoolableAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	args := m.Called(ctx)
	return args.Get(0).(*types.SchemaInfo), args.Error(1)
}

func (m *MockPoolableAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	args := m.Called(ctx, tableName)
	return args.Get(0).(*types.TableInfo), args.Error(1)
}

func (m *MockPoolableAdapter) IsConnected() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockPoolableAdapter) GetConnectionInfo() *entities.Connection {
	args := m.Called()
	return args.Get(0).(*entities.Connection)
}

func (m *MockPoolableAdapter) HealthCheck(ctx context.Context) (*types.HealthStatus, error) {
	args := m.Called(ctx)
	return args.Get(0).(*types.HealthStatus), args.Error(1)
}

func (m *MockPoolableAdapter) GetMetrics(ctx context.Context) (*types.ConnectionMetrics, error) {
	args := m.Called(ctx)
	return args.Get(0).(*types.ConnectionMetrics), args.Error(1)
}

func (m *MockPoolableAdapter) Ping(ctx context.Context) (time.Duration, error) {
	args := m.Called(ctx)
	return args.Get(0).(time.Duration), args.Error(1)
}

func (m *MockPoolableAdapter) BeginTx(ctx context.Context) (types.Transaction, error) {
	args := m.Called(ctx)
	return args.Get(0).(types.Transaction), args.Error(1)
}

func (m *MockPoolableAdapter) GetPoolableConfig() PoolableConfig {
	args := m.Called()
	return args.Get(0).(PoolableConfig)
}

func (m *MockPoolableAdapter) ResetConnection(ctx context.Context) error {
	args := m.Called(ctx)
	return args.Error(0)
}

func TestNewEnhancedBaseAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:   "test-conn-1",
		Type: "postgresql",
		Host: "localhost",
		Port: 5432,
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel) // Reduce noise in tests

	t.Run("WithValidConnection", func(t *testing.T) {
		adapter := NewEnhancedBaseAdapter(conn, logger)

		assert.NotNil(t, adapter)
		assert.Equal(t, conn, adapter.GetConnection())
		assert.NotNil(t, adapter.GetConfig())
		assert.NotNil(t, adapter.GetLogger())
	})

	t.Run("WithNilLogger", func(t *testing.T) {
		adapter := NewEnhancedBaseAdapter(conn, nil)

		assert.NotNil(t, adapter)
		assert.NotNil(t, adapter.GetLogger())
		assert.Equal(t, logrus.InfoLevel, adapter.GetLogger().GetLevel())
	})

	t.Run("WithConnectionOptions", func(t *testing.T) {
		connWithOpts := &entities.Connection{
			ID:   "test-conn-2",
			Type: "mysql",
			Host: "localhost",
			Port: 3306,
			Options: map[string]string{
				"max_open_conns":  "20",
				"max_idle_conns":  "5",
				"connect_timeout": "15s",
				"query_timeout":   "10s",
			},
		}

		adapter := NewEnhancedBaseAdapter(connWithOpts, logger)
		config := adapter.GetConfig()

		assert.Equal(t, 20, config.MaxOpenConns)
		assert.Equal(t, 5, config.MaxIdleConns)
		assert.Equal(t, time.Second*15, config.ConnectTimeout)
		assert.Equal(t, time.Second*10, config.QueryTimeout)
	})
}

func TestEnhancedBaseAdapter_TrackQuery(t *testing.T) {
	t.Run("TrackQueryStart", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		startTime := adapter.TrackQueryStart("SELECT * FROM users")
		assert.False(t, startTime.IsZero())
		assert.WithinDuration(t, time.Now(), startTime, time.Millisecond*100)
	})

	t.Run("TrackQueryEnd_Success", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		startTime := time.Now()
		time.Sleep(time.Millisecond * 10) // Simulate some execution time

		adapter.TrackQueryEnd(startTime, true, nil)
		stats := adapter.GetQueryStats()

		assert.Equal(t, int64(1), stats.TotalQueries)
		assert.Equal(t, int64(0), stats.FailedQueries)
		assert.Greater(t, stats.TotalDuration, time.Duration(0))
		assert.False(t, stats.LastQueryTime.IsZero())
	})

	t.Run("TrackQueryEnd_Failure", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		startTime := time.Now()

		adapter.TrackQueryEnd(startTime, false, assert.AnError)
		stats := adapter.GetQueryStats()

		assert.Equal(t, int64(1), stats.TotalQueries)
		assert.Equal(t, int64(1), stats.FailedQueries)
	})

	t.Run("TrackQueryEnd_SlowQuery", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		startTime := time.Now()
		time.Sleep(time.Millisecond * 10) // Ensure it's over the threshold

		// Set a very low threshold to trigger slow query detection
		adapter.SetSlowQueryThreshold(time.Millisecond * 5)
		adapter.TrackQueryEnd(startTime, true, nil)

		stats := adapter.GetQueryStats()
		assert.Equal(t, int64(1), stats.SlowQueries)
	})
}

func TestEnhancedBaseAdapter_HealthCheck(t *testing.T) {
	t.Run("RecordHealthyCheck", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		responseTime := time.Millisecond * 50
		adapter.RecordHealthCheck(true, responseTime, nil)

		health := adapter.GetLastHealthCheck()
		assert.True(t, health.Healthy)
		assert.Equal(t, responseTime, health.ResponseTime)
		assert.Empty(t, health.ErrorMessage)
		assert.False(t, health.LastChecked.IsZero())
	})

	t.Run("RecordUnhealthyCheck", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		err := assert.AnError
		adapter.RecordHealthCheck(false, 0, err)

		health := adapter.GetLastHealthCheck()
		assert.False(t, health.Healthy)
		assert.Equal(t, err.Error(), health.ErrorMessage)
		assert.Zero(t, health.ResponseTime)
	})

	t.Run("IsHealthy", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		// Initially should be unhealthy (no health check recorded)
		assert.False(t, adapter.IsHealthy())

		// Record a healthy check
		adapter.RecordHealthCheck(true, time.Millisecond*10, nil)
		assert.True(t, adapter.IsHealthy())

		// Record an unhealthy check
		adapter.RecordHealthCheck(false, 0, assert.AnError)
		assert.False(t, adapter.IsHealthy())
	})
}

func TestEnhancedBaseAdapter_CreateError(t *testing.T) {
	conn := &entities.Connection{
		ID:   "test-conn",
		Type: "postgresql",
		Host: "localhost",
		Port: 5432,
	}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	t.Run("BasicError", func(t *testing.T) {
		err := adapter.CreateError("TEST_CODE", "Test message", "Test details", "", nil)

		assert.Equal(t, "TEST_CODE", err.Code)
		assert.Equal(t, "Test message", err.Message)
		assert.Equal(t, "Test details", err.Details)
		assert.False(t, err.Timestamp.IsZero())
	})

	t.Run("ErrorWithQuery", func(t *testing.T) {
		query := "SELECT * FROM users"
		params := []interface{}{1, 2, 3}
		err := adapter.CreateError("QUERY_FAILED", "Query failed", "", query, params...)

		assert.Equal(t, query, err.Query)
		assert.Equal(t, params, err.Params)
	})

	t.Run("ErrorWithContext", func(t *testing.T) {
		err := adapter.CreateError("CONN_FAILED", "Connection failed", "", "", nil)

		assert.Contains(t, err.Context, "connection_id")
		assert.Contains(t, err.Context, "database_type")
		assert.Contains(t, err.Context, "host")
		assert.Contains(t, err.Context, "port")

		assert.Equal(t, conn.ID, err.Context["connection_id"])
		assert.Equal(t, conn.Type, err.Context["database_type"])
		assert.Equal(t, conn.Host, err.Context["host"])
		assert.Equal(t, conn.Port, err.Context["port"])
	})
}

func TestEnhancedBaseAdapter_ShouldRetry(t *testing.T) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	t.Run("RetryableError", func(t *testing.T) {
		err := types.NewAdapterError(types.ErrCodeConnectionFailed, "Connection failed", "").WithRetryable(true)
		assert.True(t, adapter.ShouldRetry(err, 0))
	})

	t.Run("NonRetryableError", func(t *testing.T) {
		err := types.NewAdapterError(types.ErrCodeInvalidQuery, "Invalid query", "")
		assert.False(t, adapter.ShouldRetry(err, 0))
	})

	t.Run("MaxRetriesExceeded", func(t *testing.T) {
		err := types.NewAdapterError(types.ErrCodeConnectionFailed, "Connection failed", "").WithRetryable(true)
		assert.False(t, adapter.ShouldRetry(err, 5)) // Assuming default max retries is 3
	})

	t.Run("StandardError", func(t *testing.T) {
		// Non-AdapterError should not be retryable by default
		assert.False(t, adapter.ShouldRetry(assert.AnError, 0))
	})
}

func TestEnhancedBaseAdapter_ExecuteWithRetry(t *testing.T) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	t.Run("SuccessOnFirstTry", func(t *testing.T) {
		callCount := 0
		fn := func() error {
			callCount++
			return nil
		}

		err := adapter.ExecuteWithRetry(context.Background(), fn)
		assert.NoError(t, err)
		assert.Equal(t, 1, callCount)
	})

	t.Run("SuccessAfterRetries", func(t *testing.T) {
		callCount := 0
		fn := func() error {
			callCount++
			if callCount < 3 {
				return types.NewAdapterError(types.ErrCodeConnectionFailed, "Connection failed", "").WithRetryable(true)
			}
			return nil
		}

		err := adapter.ExecuteWithRetry(context.Background(), fn)
		assert.NoError(t, err)
		assert.Equal(t, 3, callCount)
	})

	t.Run("MaxRetriesExceeded", func(t *testing.T) {
		callCount := 0
		expectedErr := types.NewAdapterError(types.ErrCodeConnectionFailed, "Connection failed", "").WithRetryable(true)
		fn := func() error {
			callCount++
			return expectedErr
		}

		err := adapter.ExecuteWithRetry(context.Background(), fn)
		assert.Error(t, err)
		assert.Equal(t, expectedErr, err)
		assert.GreaterOrEqual(t, callCount, 4) // Should try at least maxRetries + 1 times
	})

	t.Run("NonRetryableError", func(t *testing.T) {
		callCount := 0
		expectedErr := types.NewAdapterError(types.ErrCodeInvalidQuery, "Invalid query", "")
		fn := func() error {
			callCount++
			return expectedErr
		}

		err := adapter.ExecuteWithRetry(context.Background(), fn)
		assert.Error(t, err)
		assert.Equal(t, 1, callCount) // Should only try once
	})

	t.Run("ContextCancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		callCount := 0
		fn := func() error {
			callCount++
			return assert.AnError
		}

		err := adapter.ExecuteWithRetry(ctx, fn)
		assert.Error(t, err)
		assert.Equal(t, context.Canceled, err)
		assert.Equal(t, 0, callCount) // Should not try at all
	})
}

func TestEnhancedBaseAdapter_UpdateMetrics(t *testing.T) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	poolStats := types.ConnectionPoolStats{
		MaxOpenConnections: 20,
		OpenConnections:    8,
		InUseConnections:   3,
		IdleConnections:    5,
		WaitCount:          10,
		WaitDuration:       time.Millisecond * 100,
	}

	dbInfo := types.DatabaseInfo{
		Version:    "13.0",
		Engine:     "PostgreSQL",
		Charset:    "UTF8",
		TableCount: 15,
		IndexCount: 25,
	}

	adapter.UpdateMetrics(poolStats, dbInfo)
	metrics := adapter.GetMetrics()

	assert.Equal(t, poolStats, metrics.ConnectionPoolStats)
	assert.Equal(t, dbInfo, metrics.DatabaseInfo)
	assert.False(t, metrics.LastUpdated.IsZero())
}

func TestEnhancedBaseAdapter_ValidateConnection(t *testing.T) {
	t.Run("ValidConnection", func(t *testing.T) {
		conn := &entities.Connection{
			ID:   "test",
			Type: "postgresql",
			Host: "localhost",
			Port: 5432,
		}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		err := adapter.ValidateConnection()
		assert.NoError(t, err)
	})

	t.Run("NilConnection", func(t *testing.T) {
		adapter := NewEnhancedBaseAdapter(nil, logrus.New())

		err := adapter.ValidateConnection()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "connection is nil")
	})

	t.Run("MissingHost", func(t *testing.T) {
		conn := &entities.Connection{
			ID:   "test",
			Type: "postgresql",
			Port: 5432,
		}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		err := adapter.ValidateConnection()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "host is required")
	})

	t.Run("InvalidPort", func(t *testing.T) {
		conn := &entities.Connection{
			ID:   "test",
			Type: "postgresql",
			Host: "localhost",
			Port: 0,
		}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		err := adapter.ValidateConnection()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "port must be greater than 0")
	})

	t.Run("MissingType", func(t *testing.T) {
		conn := &entities.Connection{
			ID:   "test",
			Host: "localhost",
			Port: 5432,
		}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		err := adapter.ValidateConnection()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "database type is required")
	})
}

func TestEnhancedBaseAdapter_BuildConnectionString(t *testing.T) {
	t.Run("BasicConnectionString", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		base := "postgresql://user:pass@localhost:5432/db"
		result := adapter.BuildConnectionString(base)
		assert.Equal(t, base, result)
	})

	t.Run("WithSSLOptions", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		// Set SSL mode using the setter method
		adapter.SetSSLMode("require")

		base := "postgresql://user:pass@localhost:5432/db"
		result := adapter.BuildConnectionString(base)

		assert.Contains(t, result, "sslmode=require")
	})

	t.Run("WithExistingParams", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		adapter.SetSSLMode("require")

		base := "postgresql://user:pass@localhost:5432/db?param1=value1"
		result := adapter.BuildConnectionString(base)

		assert.Contains(t, result, "param1=value1")
		assert.Contains(t, result, "sslmode=require")
	})

	t.Run("WithEmptyBase", func(t *testing.T) {
		conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
		adapter := NewEnhancedBaseAdapter(conn, logrus.New())

		adapter.SetSSLMode("require")

		base := ""
		result := adapter.BuildConnectionString(base)

		assert.Equal(t, "?sslmode=require", result)
	})
}

func TestEnhancedBaseAdapter_SlowQueryThreshold(t *testing.T) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	t.Run("DefaultThreshold", func(t *testing.T) {
		threshold := adapter.GetSlowQueryThreshold()
		assert.Equal(t, time.Second, threshold)
	})

	t.Run("SetCustomThreshold", func(t *testing.T) {
		customThreshold := time.Millisecond * 500
		adapter.SetSlowQueryThreshold(customThreshold)

		assert.Equal(t, customThreshold, adapter.GetSlowQueryThreshold())
	})
}

// Benchmark tests
func BenchmarkTrackQuery(b *testing.B) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		start := adapter.TrackQueryStart("SELECT 1")
		adapter.TrackQueryEnd(start, true, nil)
	}
}

func BenchmarkCreateError(b *testing.B) {
	conn := &entities.Connection{ID: "test", Type: "postgresql", Host: "localhost", Port: 5432}
	adapter := NewEnhancedBaseAdapter(conn, logrus.New())

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = adapter.CreateError("TEST_CODE", "Test message", "Test details", "SELECT 1", 1, 2, 3)
	}
}
