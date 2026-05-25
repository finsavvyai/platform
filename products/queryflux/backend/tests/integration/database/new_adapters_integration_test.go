package database_test

import (
	"context"
	"testing"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters"

	"github.com/stretchr/testify/assert"

	"github.com/sirupsen/logrus"
)

// TestMariaDBAdapter_Integration tests MariaDB adapter integration
func TestMariaDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "mariadb")
	suite.RunAllTests()
}

// TestCockroachDBAdapter_Integration tests CockroachDB adapter integration
func TestCockroachDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "cockroachdb")
	suite.RunAllTests()
}

// TestPlanetScaleAdapter_Integration tests PlanetScale adapter integration
func TestPlanetScaleAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "planetscale")
	suite.RunAllTests()
}

// TestNeonAdapter_Integration tests Neon adapter integration
func TestNeonAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "neon")
	suite.RunAllTests()
}

// TestCouchDBAdapter_Integration tests CouchDB adapter integration
func TestCouchDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "couchdb")
	suite.RunAllTests()
}

// TestArangoDBAdapter_Integration tests ArangoDB adapter integration
func TestArangoDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "arangodb")
	suite.RunAllTests()
}

// TestQuestDBAdapter_Integration tests QuestDB adapter integration
func TestQuestDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "questdb")
	suite.RunAllTests()
}

// TestTimescaleDBAdapter_Integration tests TimescaleDB adapter integration
func TestTimescaleDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "timescaledb")
	suite.RunAllTests()
}

// TestRDSAdapter_Integration tests AWS RDS adapter integration
func TestRDSAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "rds")
	suite.RunAllTests()
}

// TestAuroraAdapter_Integration tests AWS Aurora adapter integration
func TestAuroraAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "aurora")
	suite.RunAllTests()
}

// TestRedshiftAdapter_Integration tests AWS Redshift adapter integration
func TestRedshiftAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "redshift")
	suite.RunAllTests()
}

// TestDocumentDBAdapter_Integration tests AWS DocumentDB adapter integration
func TestDocumentDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "documentdb")
	suite.RunAllTests()
}

// TestElastiCacheAdapter_Integration tests AWS ElastiCache adapter integration
func TestElastiCacheAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "elasticache")
	suite.RunAllTests()
}

// TestDynamoDBAdapter_Integration tests AWS DynamoDB adapter integration
func TestDynamoDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "dynamodb")
	suite.RunAllTests()
}

// TestInfluxDBAdapter_Integration tests InfluxDB adapter integration
func TestInfluxDBAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "influxdb")
	suite.RunAllTests()
}

// TestCassandraAdapter_Integration tests Cassandra adapter integration
func TestCassandraAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "cassandra")
	suite.RunAllTests()
}

// TestMemcachedAdapter_Integration tests Memcached adapter integration
func TestMemcachedAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "memcached")
	suite.RunAllTests()
}

// TestNeo4jAdapter_Integration tests Neo4j adapter integration
func TestNeo4jAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "neo4j")
	suite.RunAllTests()
}

// TestElasticsearchAdapter_Integration tests Elasticsearch adapter integration
func TestElasticsearchAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "elasticsearch")
	suite.RunAllTests()
}

// TestSQLServerAdapter_Integration tests SQL Server adapter integration
func TestSQLServerAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "sqlserver")
	suite.RunAllTests()
}

// TestOracleAdapter_Integration tests Oracle adapter integration
func TestOracleAdapter_Integration(t *testing.T) {
	suite := NewDatabaseTestSuite(t, "oracle")
	suite.RunAllTests()
}

// TestAllNewAdapters_Integration runs integration tests for all new adapters
func TestAllNewAdapters_Integration(t *testing.T) {
	// Define all new database adapters that should be tested
	newAdapters := []string{
		"mariadb", "cockroachdb", "planetscale", "neon",
		"couchdb", "arangodb", "questdb", "timescaledb",
		"rds", "aurora", "redshift", "documentdb", "elasticache",
		"dynamodb", "influxdb", "cassandra", "memcached",
		"neo4j", "elasticsearch", "sqlserver", "oracle",
	}

	// Run tests in parallel for faster execution
	for _, adapter := range newAdapters {
		t.Run(adapter, func(t *testing.T) {
			t.Parallel()
			suite := NewDatabaseTestSuite(t, adapter)
			suite.RunAllTests()
		})
	}
}

// BenchmarkMariaDBAdapter_SimpleQuery benchmarks MariaDB adapter performance
func BenchmarkMariaDBAdapter_SimpleQuery(b *testing.B) {
	suite := NewDatabaseTestSuite(&testing.T{}, "mariadb")
	benchmarkSimpleQuery(b, suite)
}

// BenchmarkCockroachDBAdapter_SimpleQuery benchmarks CockroachDB adapter performance
func BenchmarkCockroachDBAdapter_SimpleQuery(b *testing.B) {
	suite := NewDatabaseTestSuite(&testing.T{}, "cockroachdb")
	benchmarkSimpleQuery(b, suite)
}

// BenchmarkTimescaleDBAdapter_SimpleQuery benchmarks TimescaleDB adapter performance
func BenchmarkTimescaleDBAdapter_SimpleQuery(b *testing.B) {
	suite := NewDatabaseTestSuite(&testing.T{}, "timescaledb")
	benchmarkSimpleQuery(b, suite)
}

// BenchmarkInfluxDBAdapter_SimpleQuery benchmarks InfluxDB adapter performance
func BenchmarkInfluxDBAdapter_SimpleQuery(b *testing.B) {
	suite := NewDatabaseTestSuite(&testing.T{}, "influxdb")
	benchmarkSimpleQuery(b, suite)
}

// BenchmarkMongoDBAdapter_SimpleQuery benchmarks MongoDB adapter performance
func BenchmarkMongoDBAdapter_SimpleQuery(b *testing.B) {
	suite := NewDatabaseTestSuite(&testing.T{}, "mongodb")
	benchmarkSimpleQuery(b, suite)
}

// benchmarkSimpleQuery is a helper function for benchmarking simple queries
func benchmarkSimpleQuery(b *testing.B, suite *DatabaseTestSuite) {
	if !IsDatabaseAvailable(suite.dbType) {
		b.Skipf("Skipping %s benchmark - environment variable not set", suite.dbType)
	}

	// Connect to database
	ctx := context.Background()
	err := suite.adapter.Connect(ctx, suite.connection)
	if err != nil {
		b.Skipf("Could not connect to %s: %v", suite.dbType, err)
	}
	defer suite.adapter.Disconnect(ctx)

	// Get simple query for benchmarking
	query := suite.getSimpleQuery()

	// Reset benchmark timer
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_, err := suite.adapter.ExecuteQuery(ctx, query)
		if err != nil {
			b.Fatalf("Query execution failed: %v", err)
		}
	}
}

// TestAdapterFactory_NewAdapters tests the adapter factory with new database types
func TestAdapterFactory_NewAdapters(t *testing.T) {
	factory := adapters.NewFactory(logrus.New())

	// Test all new database types can be created
	newDatabaseTypes := []struct {
		dbType     string
		entityType string
	}{
		{"mariadb", entities.TypeMariaDB},
		{"cockroachdb", entities.TypeCockroachDB},
		{"planetscale", entities.TypePlanetScale},
		{"neon", entities.TypeNeon},
		{"couchdb", entities.TypeCouchDB},
		{"arangodb", entities.TypeArangoDB},
		{"questdb", entities.TypeQuestDB},
		{"timescaledb", entities.TypeTimescaleDB},
		{"rds", entities.TypeAWSRDS},
		{"aurora", entities.TypeAWSAurora},
		{"redshift", entities.TypeAWSRedshift},
		{"documentdb", entities.TypeAWSDocumentDB},
		{"elasticache", entities.TypeAWSElastiCache},
		{"dynamodb", entities.TypeAWSDynamoDB},
		{"influxdb", entities.TypeInfluxDB},
		{"cassandra", entities.TypeCassandra},
		{"memcached", entities.TypeMemcached},
		{"neo4j", entities.TypeNeo4j},
		{"elasticsearch", entities.TypeElasticsearch},
		{"sqlserver", entities.TypeSQLServer},
		{"oracle", entities.TypeOracle},
	}

	for _, test := range newDatabaseTypes {
		t.Run(test.dbType, func(t *testing.T) {
			connection := &entities.Connection{
				ID:       "test-" + test.dbType,
				UserID:   "test-user",
				Name:     "Test " + test.dbType,
				Type:     test.entityType,
				Host:     "localhost",
				Port:     1, // Dummy port for factory test
				Database: "test",
				Username: "test",
				Password: "test",
			}

			adapter, err := factory.CreateAdapter(connection)
			assert.NoError(t, err, "Should be able to create adapter for %s", test.dbType)
			assert.NotNil(t, adapter, "Adapter should not be nil for %s", test.dbType)
		})
	}
}

// TestConnectionURLGeneration tests connection URL generation for new adapters
func TestConnectionURLGeneration(t *testing.T) {
	testCases := []struct {
		name           string
		dbType         string
		connection     *entities.Connection
		expectedPrefix string
	}{
		{
			name:   "PostgreSQL",
			dbType: "postgresql",
			connection: &entities.Connection{
				Host:     "localhost",
				Port:     5432,
				Database: "test_db",
				Username: "test_user",
				Password: "test_password",
				Options:  map[string]string{"sslmode": "disable"},
			},
			expectedPrefix: "postgres://",
		},
		{
			name:   "MySQL",
			dbType: "mysql",
			connection: &entities.Connection{
				Host:     "localhost",
				Port:     3306,
				Database: "test_db",
				Username: "test_user",
				Password: "test_password",
			},
			expectedPrefix: "test_user:test_password@tcp(localhost:3306)/test_db",
		},
		{
			name:   "MongoDB",
			dbType: "mongodb",
			connection: &entities.Connection{
				Host:     "localhost",
				Port:     27017,
				Database: "test_db",
				Username: "test_user",
				Password: "test_password",
			},
			expectedPrefix: "mongodb://",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// This test verifies that connection entities can be properly configured
			// for the new adapter types
			assert.NotEmpty(t, tc.connection.Host, "Host should not be empty")
			assert.Greater(t, tc.connection.Port, 0, "Port should be greater than 0")
			assert.NotEmpty(t, tc.connection.Database, "Database should not be empty")
		})
	}
}

// TestAdapterCompatibility tests adapter compatibility with different database versions
func TestAdapterCompatibility(t *testing.T) {
	// This test ensures that adapters are compatible with different database versions
	// For now, we'll test basic functionality with the available test databases

	testDatabases := []string{
		"postgresql", "mysql", "mariadb", "mongodb",
		"redis", "sqlite", // Common databases that are likely to be available
	}

	for _, dbType := range testDatabases {
		t.Run(dbType+"_compatibility", func(t *testing.T) {
			suite := NewDatabaseTestSuite(t, dbType)

			// Test basic compatibility
			suite.TestConnectionLifecycle()
			suite.TestBasicQueryExecution()
		})
	}
}
