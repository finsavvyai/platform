package adapters_test

import (
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFactory_NewFactory(t *testing.T) {
	factory := adapters.NewFactory()
	assert.NotNil(t, factory)
}

func TestFactory_CreateAdapter_PostgreSQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test PostgreSQL",
		Type:     entities.TypePostgreSQL,
		Host:     "localhost",
		Port:     5432,
		Database: "test_db",
		Username: "postgres",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_MySQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test MySQL",
		Type:     entities.TypeMySQL,
		Host:     "localhost",
		Port:     3306,
		Database: "test_db",
		Username: "root",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_MongoDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test MongoDB",
		Type:     entities.TypeMongoDB,
		Host:     "localhost",
		Port:     27017,
		Database: "test_db",
		Username: "admin",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Redis(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Redis",
		Type:     entities.TypeRedis,
		Host:     "localhost",
		Port:     6379,
		Database: "0",
		Username: "",
		Password: "",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Cassandra(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Cassandra",
		Type:     entities.TypeCassandra,
		Host:     "localhost",
		Port:     9042,
		Database: "test_keyspace",
		Username: "cassandra",
		Password: "cassandra",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Neo4j(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Neo4j",
		Type:     entities.TypeNeo4j,
		Host:     "localhost",
		Port:     7687,
		Database: "neo4j",
		Username: "neo4j",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Memcached(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Memcached",
		Type:     entities.TypeMemcached,
		Host:     "localhost",
		Port:     11211,
		Database: "",
		Username: "",
		Password: "",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_InfluxDB(t *testing.T) {
	factory := adapters.NewFactory()
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

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_DynamoDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test DynamoDB",
		Type:     entities.TypeAWSDynamoDB,
		Host:     "us-east-1",
		Port:     443,
		Database: "",
		Username: "access-key",
		Password: "secret-key",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_MariaDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test MariaDB",
		Type:     entities.TypeMariaDB,
		Host:     "localhost",
		Port:     3306,
		Database: "test_db",
		Username: "root",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_SQLite(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test SQLite",
		Type:     entities.TypeSQLite,
		Host:     "",
		Port:     0,
		Database: "/tmp/test.db",
		Username: "",
		Password: "",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_SQLServer(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test SQL Server",
		Type:     entities.TypeSQLServer,
		Host:     "localhost",
		Port:     1433,
		Database: "test_db",
		Username: "sa",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Oracle(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Oracle",
		Type:     entities.TypeOracle,
		Host:     "localhost",
		Port:     1521,
		Database: "XE",
		Username: "system",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_CockroachDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CockroachDB",
		Type:     entities.TypeCockroachDB,
		Host:     "localhost",
		Port:     26257,
		Database: "test_db",
		Username: "root",
		Password: "",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_TimescaleDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test TimescaleDB",
		Type:     entities.TypeTimescaleDB,
		Host:     "localhost",
		Port:     5432,
		Database: "test_db",
		Username: "postgres",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_QuestDB(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test QuestDB",
		Type:     entities.TypeQuestDB,
		Host:     "localhost",
		Port:     8812,
		Database: "qdb",
		Username: "admin",
		Password: "quest",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_Supabase(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Supabase",
		Type:     entities.TypeSupabase,
		Host:     "db.project.supabase.co",
		Port:     5432,
		Database: "postgres",
		Username: "postgres",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_UnsupportedType(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test Unsupported",
		Type:     "unsupported-db",
		Host:     "localhost",
		Port:     1234,
		Database: "test_db",
		Username: "user",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.Error(t, err)
	assert.Nil(t, adapter)
	assert.Contains(t, err.Error(), "Unsupported database type")
}

// Test AWS RDS with different engines
func TestFactory_CreateAdapter_AWSRDS_PostgreSQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test AWS RDS PostgreSQL",
		Type:     entities.TypeAWSRDS,
		Host:     "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
		Port:     5432,
		Database: "postgres",
		Username: "postgres",
		Password: "password",
		Options: map[string]string{
			"engine": "postgres",
		},
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_AWSRDS_MySQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test AWS RDS MySQL",
		Type:     entities.TypeAWSRDS,
		Host:     "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
		Port:     3306,
		Database: "mysql",
		Username: "admin",
		Password: "password",
		Options: map[string]string{
			"engine": "mysql",
		},
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

// Test AWS Aurora with different engines
func TestFactory_CreateAdapter_AWSAurora_PostgreSQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test AWS Aurora PostgreSQL",
		Type:     entities.TypeAWSAurora,
		Host:     "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
		Port:     5432,
		Database: "postgres",
		Username: "postgres",
		Password: "password",
		Options: map[string]string{
			"engine": "aurora-postgresql",
		},
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

func TestFactory_CreateAdapter_AWSAurora_MySQL(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test AWS Aurora MySQL",
		Type:     entities.TypeAWSAurora,
		Host:     "mydb.cluster-xyz.us-east-1.rds.amazonaws.com",
		Port:     3306,
		Database: "mysql",
		Username: "admin",
		Password: "password",
		Options: map[string]string{
			"engine": "aurora-mysql",
		},
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.NotNil(t, adapter)
	assert.Equal(t, conn, adapter.GetConnectionInfo())
}

// Test placeholder adapters (should return nil for unimplemented ones)
func TestFactory_CreateAdapter_CouchDB_NotImplemented(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test CouchDB",
		Type:     entities.TypeCouchDB,
		Host:     "localhost",
		Port:     5984,
		Database: "test_db",
		Username: "admin",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.Nil(t, adapter) // Should be nil for unimplemented adapters
}

func TestFactory_CreateAdapter_ArangoDB_NotImplemented(t *testing.T) {
	factory := adapters.NewFactory()
	conn := &entities.Connection{
		ID:       "test-id",
		UserID:   "user-1",
		Name:     "Test ArangoDB",
		Type:     entities.TypeArangoDB,
		Host:     "localhost",
		Port:     8529,
		Database: "_system",
		Username: "root",
		Password: "password",
	}

	adapter, err := factory.CreateAdapter(conn)
	assert.NoError(t, err)
	assert.Nil(t, adapter) // Should be nil for unimplemented adapters
}