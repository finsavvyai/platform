package types

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestAdapterError(t *testing.T) {
	t.Run("NewAdapterError", func(t *testing.T) {
		err := NewAdapterError("TEST_CODE", "Test message", "Test details")

		assert.Equal(t, "TEST_CODE", err.Code)
		assert.Equal(t, "Test message", err.Message)
		assert.Equal(t, "Test details", err.Details)
		assert.False(t, time.Time{}.Equal(err.Timestamp))
		assert.NotNil(t, err.Context)
		assert.False(t, err.Retryable)
	})

	t.Run("AdapterError.Error", func(t *testing.T) {
		t.Run("WithDetails", func(t *testing.T) {
			err := NewAdapterError("CODE", "Message", "Details")
			assert.Equal(t, "Message: Details", err.Error())
		})

		t.Run("WithoutDetails", func(t *testing.T) {
			err := NewAdapterError("CODE", "Message", "")
			assert.Equal(t, "Message", err.Error())
		})
	})

	t.Run("WithQuery", func(t *testing.T) {
		err := NewAdapterError("CODE", "Message", "")
		params := []interface{}{1, "test"}

		result := err.WithQuery("SELECT * FROM users", params...)

		assert.Equal(t, "SELECT * FROM users", err.Query)
		assert.Equal(t, params, err.Params)
		assert.Same(t, err, result) // Should return same instance
	})

	t.Run("WithContext", func(t *testing.T) {
		err := NewAdapterError("CODE", "Message", "")

		result := err.WithContext("key1", "value1").WithContext("key2", 123)

		assert.Equal(t, "value1", err.Context["key1"])
		assert.Equal(t, 123, err.Context["key2"])
		assert.Same(t, err, result) // Should return same instance
	})

	t.Run("WithRetryable", func(t *testing.T) {
		err := NewAdapterError("CODE", "Message", "")

		result := err.WithRetryable(true)

		assert.True(t, err.Retryable)
		assert.Same(t, err, result) // Should return same instance
	})
}

func TestConnectionConfig(t *testing.T) {
	t.Run("DefaultConnectionConfig", func(t *testing.T) {
		config := DefaultConnectionConfig()

		assert.Equal(t, 10, config.MaxOpenConns)
		assert.Equal(t, 2, config.MaxIdleConns)
		assert.Equal(t, time.Hour, config.ConnMaxLifetime)
		assert.Equal(t, time.Minute*30, config.ConnMaxIdleTime)
		assert.Equal(t, time.Second*10, config.ConnectTimeout)
		assert.Equal(t, time.Minute*5, config.QueryTimeout)
		assert.Equal(t, time.Second*30, config.ReadTimeout)
		assert.Equal(t, time.Second*30, config.WriteTimeout)
		assert.Equal(t, 3, config.MaxRetries)
		assert.Equal(t, time.Second, config.RetryDelay)
		assert.Equal(t, time.Second*2, config.RetryBackoff)
		assert.Equal(t, time.Second*30, config.HealthCheckInterval)
		assert.Equal(t, time.Second*5, config.HealthCheckTimeout)
		assert.Equal(t, "prefer", config.SSLMode)
		assert.NotNil(t, config.Options)
	})
}

func TestQueryResult(t *testing.T) {
	t.Run("ValidQueryResult", func(t *testing.T) {
		columns := []ColumnInfo{
			{Name: "id", Type: "integer"},
			{Name: "name", Type: "varchar"},
			{Name: "email", Type: "varchar"},
		}
		rows := []map[string]interface{}{
			{"id": 1, "name": "John", "email": "john@example.com"},
			{"id": 2, "name": "Jane", "email": "jane@example.com"},
		}
		count := int64(len(rows))

		result := &QueryResult{
			Columns: columns,
			Rows:    rows,
			Count:   count,
		}

		assert.Equal(t, columns, result.Columns)
		assert.Equal(t, rows, result.Rows)
		assert.Equal(t, count, result.Count)
	})

	t.Run("EmptyQueryResult", func(t *testing.T) {
		result := &QueryResult{}

		assert.Empty(t, result.Columns)
		assert.Empty(t, result.Rows)
		assert.Zero(t, result.Count)
	})
}

func TestSchemaInfo(t *testing.T) {
	t.Run("ValidSchemaInfo", func(t *testing.T) {
		tables := []TableInfo{
			{
				Name:   "users",
				Schema: "public",
				Columns: []ColumnInfo{
					{Name: "id", Type: "integer", IsPrimaryKey: true},
					{Name: "name", Type: "varchar", Nullable: true},
				},
			},
		}

		schema := &SchemaInfo{Tables: tables}

		assert.Equal(t, tables, schema.Tables)
		assert.Len(t, schema.Tables, 1)
		assert.Equal(t, "users", schema.Tables[0].Name)
	})
}

func TestTableInfo(t *testing.T) {
	t.Run("ValidTableInfo", func(t *testing.T) {
		columns := []ColumnInfo{
			{Name: "id", Type: "integer", IsPrimaryKey: true},
			{Name: "email", Type: "varchar", Nullable: false, IsForeignKey: false},
		}
		indexes := []IndexInfo{
			{Name: "users_pkey", Columns: []string{"id"}, Unique: true},
			{Name: "users_email_idx", Columns: []string{"email"}, Unique: true},
		}

		table := &TableInfo{
			Name:    "users",
			Schema:  "public",
			Columns: columns,
			Indexes: indexes,
		}

		assert.Equal(t, "users", table.Name)
		assert.Equal(t, "public", table.Schema)
		assert.Equal(t, columns, table.Columns)
		assert.Equal(t, indexes, table.Indexes)
		assert.Len(t, table.Columns, 2)
		assert.Len(t, table.Indexes, 2)
	})
}

func TestColumnInfo(t *testing.T) {
	t.Run("ValidColumnInfo", func(t *testing.T) {
		column := ColumnInfo{
			Name:         "email",
			Type:         "varchar",
			Nullable:     false,
			DefaultValue: "''",
			IsPrimaryKey: false,
			IsForeignKey: false,
		}

		assert.Equal(t, "email", column.Name)
		assert.Equal(t, "varchar", column.Type)
		assert.False(t, column.Nullable)
		assert.Equal(t, "''", column.DefaultValue)
		assert.False(t, column.IsPrimaryKey)
		assert.False(t, column.IsForeignKey)
	})

	t.Run("PrimaryKeyColumn", func(t *testing.T) {
		column := ColumnInfo{
			Name:         "id",
			Type:         "integer",
			Nullable:     false,
			IsPrimaryKey: true,
			IsForeignKey: false,
		}

		assert.True(t, column.IsPrimaryKey)
		assert.False(t, column.IsForeignKey)
	})
}

func TestIndexInfo(t *testing.T) {
	t.Run("UniqueIndex", func(t *testing.T) {
		index := IndexInfo{
			Name:    "users_email_unique",
			Columns: []string{"email"},
			Unique:  true,
		}

		assert.Equal(t, "users_email_unique", index.Name)
		assert.Equal(t, []string{"email"}, index.Columns)
		assert.True(t, index.Unique)
	})

	t.Run("CompositeIndex", func(t *testing.T) {
		index := IndexInfo{
			Name: "users_name_email_idx",
			Columns: []string{
				"name",
				"email",
			},
			Unique: false,
		}

		assert.Equal(t, "users_name_email_idx", index.Name)
		assert.Equal(t, []string{
			"name",
			"email",
		}, index.Columns)
		assert.False(t, index.Unique)
	})
}

func TestHealthStatus(t *testing.T) {
	t.Run("HealthyStatus", func(t *testing.T) {
		now := time.Now()
		status := &HealthStatus{
			Healthy:           true,
			LastChecked:       now,
			ResponseTime:      time.Millisecond * 50,
			ConnectionsActive: 5,
			ConnectionsIdle:   3,
		}

		assert.True(t, status.Healthy)
		assert.Equal(t, now, status.LastChecked)
		assert.Equal(t, time.Millisecond*50, status.ResponseTime)
		assert.Equal(t, 5, status.ConnectionsActive)
		assert.Equal(t, 3, status.ConnectionsIdle)
		assert.Empty(t, status.ErrorMessage)
	})

	t.Run("UnhealthyStatus", func(t *testing.T) {
		status := &HealthStatus{
			Healthy:      false,
			LastChecked:  time.Now(),
			ResponseTime: 0,
			ErrorMessage: "Connection timeout",
		}

		assert.False(t, status.Healthy)
		assert.Equal(t, "Connection timeout", status.ErrorMessage)
		assert.Zero(t, status.ResponseTime)
	})
}

func TestConnectionMetrics(t *testing.T) {
	t.Run("ValidMetrics", func(t *testing.T) {
		poolStats := ConnectionPoolStats{
			MaxOpenConnections:     20,
			OpenConnections:        8,
			InUseConnections:       3,
			IdleConnections:        5,
			WaitCount:              10,
			WaitDuration:           time.Millisecond * 100,
			MaxIdleConnections:     10,
			MaxLifetimeConnections: time.Hour,
		}

		queryPerf := QueryPerformance{
			QueriesPerSecond:   15.5,
			AverageQueryTime:   time.Millisecond * 25,
			SlowQueriesCount:   2,
			FailedQueriesCount: 1,
			TotalQueriesCount:  100,
		}

		dbInfo := DatabaseInfo{
			Version:    "13.0",
			Engine:     "PostgreSQL",
			Charset:    "UTF8",
			Collation:  "en_US.UTF-8",
			SizeBytes:  1024 * 1024 * 100, // 100MB
			TableCount: 15,
			IndexCount: 25,
		}

		metrics := &ConnectionMetrics{
			ConnectionPoolStats: poolStats,
			QueryPerformance:    queryPerf,
			DatabaseInfo:        dbInfo,
			LastUpdated:         time.Now(),
		}

		assert.Equal(t, poolStats, metrics.ConnectionPoolStats)
		assert.Equal(t, queryPerf, metrics.QueryPerformance)
		assert.Equal(t, dbInfo, metrics.DatabaseInfo)
		assert.False(t, time.Time{}.Equal(metrics.LastUpdated))
	})
}

func TestConnectionPoolStats(t *testing.T) {
	t.Run("ValidPoolStats", func(t *testing.T) {
		stats := ConnectionPoolStats{
			MaxOpenConnections:     20,
			OpenConnections:        8,
			InUseConnections:       3,
			IdleConnections:        5,
			WaitCount:              10,
			WaitDuration:           time.Millisecond * 100,
			MaxIdleConnections:     10,
			MaxLifetimeConnections: time.Hour,
		}

		assert.Equal(t, 20, stats.MaxOpenConnections)
		assert.Equal(t, 8, stats.OpenConnections)
		assert.Equal(t, 3, stats.InUseConnections)
		assert.Equal(t, 5, stats.IdleConnections)
		assert.Equal(t, int64(10), stats.WaitCount)
		assert.Equal(t, time.Millisecond*100, stats.WaitDuration)
		assert.Equal(t, 10, stats.MaxIdleConnections)
		assert.Equal(t, time.Hour, stats.MaxLifetimeConnections)
	})
}

func TestQueryPerformance(t *testing.T) {
	t.Run("ValidPerformance", func(t *testing.T) {
		perf := QueryPerformance{
			QueriesPerSecond:   15.5,
			AverageQueryTime:   time.Millisecond * 25,
			SlowQueriesCount:   2,
			FailedQueriesCount: 1,
			TotalQueriesCount:  100,
		}

		assert.Equal(t, 15.5, perf.QueriesPerSecond)
		assert.Equal(t, time.Millisecond*25, perf.AverageQueryTime)
		assert.Equal(t, int64(2), perf.SlowQueriesCount)
		assert.Equal(t, int64(1), perf.FailedQueriesCount)
		assert.Equal(t, int64(100), perf.TotalQueriesCount)
	})
}

func TestDatabaseInfo(t *testing.T) {
	t.Run("ValidDatabaseInfo", func(t *testing.T) {
		info := DatabaseInfo{
			Version:    "13.0",
			Engine:     "PostgreSQL",
			Charset:    "UTF8",
			Collation:  "en_US.UTF-8",
			SizeBytes:  1024 * 1024 * 100, // 100MB
			TableCount: 15,
			IndexCount: 25,
		}

		assert.Equal(t, "13.0", info.Version)
		assert.Equal(t, "PostgreSQL", info.Engine)
		assert.Equal(t, "UTF8", info.Charset)
		assert.Equal(t, "en_US.UTF-8", info.Collation)
		assert.Equal(t, int64(104857600), info.SizeBytes)
		assert.Equal(t, 15, info.TableCount)
		assert.Equal(t, 25, info.IndexCount)
	})

	t.Run("MinimalDatabaseInfo", func(t *testing.T) {
		info := DatabaseInfo{
			Version: "8.0",
			Engine:  "MySQL",
		}

		assert.Equal(t, "8.0", info.Version)
		assert.Equal(t, "MySQL", info.Engine)
		assert.Empty(t, info.Charset)
		assert.Zero(t, info.TableCount)
	})
}

// Benchmark tests
func BenchmarkAdapterErrorCreation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = NewAdapterError("TEST_CODE", "Test message", "Test details")
	}
}

func BenchmarkAdapterErrorWithContext(b *testing.B) {
	err := NewAdapterError("TEST_CODE", "Test message", "")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err.WithContext("key", "value").WithQuery("SELECT 1", 1, 2, 3)
	}
}

// Example tests
func ExampleAdapterError() {
	// Create a new adapter error
	err := NewAdapterError("CONNECTION_FAILED", "Unable to connect to database", "timeout after 30s")

	// Add additional context
	err.WithQuery("SELECT * FROM users", 1, 2, 3).
		WithContext("host", "localhost").
		WithContext("port", 5432).
		WithRetryable(true)

	// Error message includes details
	_ = err.Error() // "Unable to connect to database: timeout after 30s"
}

func ExampleConnectionConfig() {
	// Get default configuration
	config := DefaultConnectionConfig()

	// Customize as needed
	config.MaxOpenConns = 20
	config.ConnectTimeout = time.Second * 15
	config.SSLMode = "require"

	// Use the configuration
	_ = config.MaxOpenConns // 20
}

func ExampleQueryResult() {
	// Create a query result
	result := &QueryResult{
		Columns: []ColumnInfo{
			{Name: "id", Type: "integer"},
			{Name: "name", Type: "varchar"},
		},
		Rows: []map[string]interface{}{
			{"id": 1, "name": "Alice"},
			{"id": 2, "name": "Bob"},
		},
		Count: 2,
	}

	// Use the result
	_ = result.Count // 2
}
