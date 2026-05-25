package sql_test

import (
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"

	"github.com/stretchr/testify/assert"
)

// TestCockroachDBAdapter tests the CockroachDB adapter (delegates to PostgreSQL)
func TestCockroachDBAdapter_NewCockroachDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CockroachDB",
		Type:     entities.TypeCockroachDB,
		Host:     "localhost",
		Port:     26257,
		Database: "testdb",
		Username: "testuser",
		Password: "testpass",
	}

	adapter := sql.NewCockroachDBAdapter(conn)
	assert.NotNil(t, adapter)
	// CockroachDB adapter delegates to PostgreSQL
	assert.NotNil(t, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

// TestTimescaleDBAdapter tests the TimescaleDB adapter (delegates to PostgreSQL)
func TestTimescaleDBAdapter_NewTimescaleDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test TimescaleDB",
		Type:     entities.TypeTimescaleDB,
		Host:     "localhost",
		Port:     5432,
		Database: "testdb",
		Username: "testuser",
		Password: "testpass",
	}

	adapter := sql.NewTimescaleDBAdapter(conn)
	assert.NotNil(t, adapter)
	// TimescaleDB adapter delegates to PostgreSQL
	assert.NotNil(t, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

// TestPlanetScaleAdapter tests the PlanetScale adapter (delegates to MySQL)
func TestPlanetScaleAdapter_NewPlanetScaleAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test PlanetScale",
		Type:     entities.TypePlanetScale,
		Host:     "aws.connect.psdb.cloud",
		Port:     3306,
		Database: "testdb",
		Username: "testuser",
		Password: "testpass",
		SSL:      true,
	}

	adapter := sql.NewPlanetScaleAdapter(conn)
	assert.NotNil(t, adapter)
	// PlanetScale adapter delegates to MySQL
	assert.NotNil(t, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

// TestNeonAdapter tests the Neon adapter (delegates to PostgreSQL)
func TestNeonAdapter_NewNeonAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neon",
		Type:     entities.TypeNeon,
		Host:     "ep-example-123456.us-east-2.aws.neon.tech",
		Port:     5432,
		Database: "testdb",
		Username: "testuser",
		Password: "testpass",
		SSL:      true,
	}

	adapter := sql.NewNeonAdapter(conn)
	assert.NotNil(t, adapter)
	// Neon adapter delegates to PostgreSQL
	assert.NotNil(t, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

// TestQuestDBAdapter tests the QuestDB adapter (delegates to PostgreSQL wire protocol)
func TestQuestDBAdapter_NewQuestDBAdapter(t *testing.T) {
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test QuestDB",
		Type:     entities.TypeQuestDB,
		Host:     "localhost",
		Port:     8812, // QuestDB PostgreSQL wire protocol port
		Database: "qdb",
		Username: "admin",
		Password: "quest",
	}

	adapter := sql.NewQuestDBAdapter(conn)
	assert.NotNil(t, adapter)
	// QuestDB adapter delegates to PostgreSQL
	assert.NotNil(t, adapter.GetConnectionInfo())
	assert.False(t, adapter.IsConnected())
}

// TestDelegatingAdapters_ConnectionInfo verifies that delegating adapters preserve connection info
func TestDelegatingAdapters_ConnectionInfo(t *testing.T) {
	tests := []struct {
		name     string
		connType string
		port     int
		factory  func(*entities.Connection) interface{ GetConnectionInfo() *entities.Connection }
	}{
		{
			name:     "CockroachDB",
			connType: entities.TypeCockroachDB,
			port:     26257,
			factory: func(c *entities.Connection) interface{ GetConnectionInfo() *entities.Connection } {
				return sql.NewCockroachDBAdapter(c)
			},
		},
		{
			name:     "TimescaleDB",
			connType: entities.TypeTimescaleDB,
			port:     5432,
			factory: func(c *entities.Connection) interface{ GetConnectionInfo() *entities.Connection } {
				return sql.NewTimescaleDBAdapter(c)
			},
		},
		{
			name:     "PlanetScale",
			connType: entities.TypePlanetScale,
			port:     3306,
			factory: func(c *entities.Connection) interface{ GetConnectionInfo() *entities.Connection } {
				return sql.NewPlanetScaleAdapter(c)
			},
		},
		{
			name:     "Neon",
			connType: entities.TypeNeon,
			port:     5432,
			factory: func(c *entities.Connection) interface{ GetConnectionInfo() *entities.Connection } {
				return sql.NewNeonAdapter(c)
			},
		},
		{
			name:     "QuestDB",
			connType: entities.TypeQuestDB,
			port:     8812,
			factory: func(c *entities.Connection) interface{ GetConnectionInfo() *entities.Connection } {
				return sql.NewQuestDBAdapter(c)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := &entities.Connection{
				ID:       "test-id",
				UserID:   "user-1",
				Name:     "Test " + tt.name,
				Type:     tt.connType,
				Host:     "localhost",
				Port:     tt.port,
				Database: "testdb",
				Username: "testuser",
				Password: "testpass",
			}

			adapter := tt.factory(conn)
			assert.NotNil(t, adapter)

			connInfo := adapter.GetConnectionInfo()
			assert.NotNil(t, connInfo)
			assert.Equal(t, conn.ID, connInfo.ID)
			assert.Equal(t, conn.Name, connInfo.Name)
			assert.Equal(t, conn.Host, connInfo.Host)
			assert.Equal(t, conn.Port, connInfo.Port)
		})
	}
}
