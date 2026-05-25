package adapters

import (
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/analytics"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/aws"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/cache"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/cloud"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/nosql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/search"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/sql"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/timeseries"
	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"
	"github.com/sirupsen/logrus"
)

// Re-export types from types package for backward compatibility
type QueryResult = types.QueryResult
type SchemaInfo = types.SchemaInfo
type TableInfo = types.TableInfo
type ColumnInfo = types.ColumnInfo
type IndexInfo = types.IndexInfo
type DatabaseAdapter = types.DatabaseAdapter
type AdapterError = types.AdapterError

// Factory creates database adapters based on connection type
type Factory struct {
	logger *logrus.Logger
}

// NewFactory creates a new adapter factory
func NewFactory(logger *logrus.Logger) *Factory {
	return &Factory{
		logger: logger,
	}
}

// CreateAdapter creates a database adapter for the given connection type
func (f *Factory) CreateAdapter(conn *entities.Connection) (DatabaseAdapter, error) {
	switch conn.Type {
	// SQL Databases
	case entities.TypePostgreSQL:
		return sql.NewPostgreSQLAdapter(conn, f.logger), nil
	case entities.TypeMySQL:
		return sql.NewMySQLAdapter(conn, f.logger), nil
	case entities.TypeMariaDB:
		return sql.NewMariaDBEnhancedAdapter(conn, f.logger), nil
	case entities.TypeSQLite:
		return sql.NewSQLiteAdapter(conn, f.logger), nil
	case entities.TypeSQLServer:
		return sql.NewSQLServerAdapter(conn, f.logger), nil
	case entities.TypeOracle:
		return sql.NewOracleAdapter(conn, f.logger), nil
	case entities.TypeCockroachDB:
		return sql.NewCockroachDBAdapter(conn, f.logger), nil
	case entities.TypeTimescaleDB:
		return timeseries.NewTimescaleDBAdapter(conn, f.logger), nil

	// NoSQL Databases
	case entities.TypeMongoDB:
		return nosql.NewMongoDBAdapter(conn, f.logger), nil
	case entities.TypeCassandra:
		return nosql.NewCassandraAdapter(conn, f.logger), nil
	case entities.TypeCouchDB:
		return nosql.NewCouchDBAdapter(conn, f.logger), nil
	case entities.TypeNeo4j:
		return nosql.NewNeo4jAdapter(conn, f.logger), nil
	case entities.TypeArangoDB:
		return nosql.NewArangoDBAdapter(conn, f.logger), nil
	case entities.TypeScyllaDB:
		return nosql.NewScyllaDBAdapter(conn, f.logger), nil

	// Cache Databases
	case entities.TypeRedis:
		return cache.NewRedisAdapter(conn, f.logger), nil
	case entities.TypeMemcached:
		return cache.NewMemcachedAdapter(conn, f.logger), nil

	// Time Series Databases
	case entities.TypeInfluxDB:
		return timeseries.NewInfluxDBAdapter(conn, f.logger), nil
	case entities.TypeQuestDB:
		return timeseries.NewQuestDBAdapter(conn, f.logger), nil

	// Analytics Databases
	case "clickhouse":
		return analytics.NewClickHouseAdapter(conn, f.logger), nil
	case "duckdb":
		return analytics.NewDuckDBAdapter(conn, f.logger), nil
	case "druid":
		return analytics.NewDruidAdapter(conn, f.logger), nil
	case "flink":
		return analytics.NewFlinkAdapter(conn, f.logger), nil

	// Cloud & Managed Services
	case entities.TypeSupabase:
		return sql.NewSupabaseAdapter(conn, f.logger), nil
	case entities.TypePlanetScale:
		return sql.NewPlanetScaleAdapter(conn, f.logger), nil
	case entities.TypeNeon:
		return sql.NewNeonAdapter(conn, f.logger), nil

	// AWS Services
	case entities.TypeAWSDynamoDB:
		return aws.NewDynamoDBAdapter(conn, f.logger), nil
	case entities.TypeAWSRDS:
		return aws.NewRDSAdapter(conn, f.logger), nil
	case entities.TypeAWSRedshift:
		return aws.NewRedshiftAdapter(conn, f.logger), nil
	case entities.TypeAWSAurora:
		return aws.NewAuroraAdapter(conn, f.logger), nil
	case entities.TypeAWSDocumentDB:
		return aws.NewDocumentDBAdapter(conn, f.logger), nil
	case entities.TypeAWSElastiCache:
		return aws.NewElastiCacheAdapter(conn, f.logger), nil
	case entities.TypeAWSNeptune:
		return aws.NewNeptuneAdapter(conn), nil // TODO: Update Neptune Adapter
	case entities.TypeAWSKeyspaces:
		return aws.NewKeyspacesAdapter(conn), nil // TODO: Update Keyspaces Adapter
	case entities.TypeAWSTimestream:
		return aws.NewTimestreamAdapter(conn), nil // TODO: Update Timestream Adapter
	case entities.TypeAWSAthena:
		return aws.NewAthenaAdapter(conn), nil // TODO: Update Athena Adapter
	case entities.TypeAWSOpenSearch:
		return aws.NewOpenSearchAdapter(conn), nil // TODO: Update OpenSearch Adapter

	// Cloud Data Warehouses
	case entities.TypeSnowflake:
		return cloud.NewSnowflakeAdapter(conn, f.logger), nil
	case entities.TypeBigQuery:
		return cloud.NewBigQueryAdapter(conn, f.logger), nil
	case entities.TypeFirebolt:
		return cloud.NewFireboltAdapter(conn, f.logger), nil

	// NewSQL Databases
	case entities.TypeYugabyteDB:
		return sql.NewYugabyteAdapter(conn), nil // TODO: Update Yugabyte Adapter
	case entities.TypeTiDB:
		return sql.NewTiDBEnhancedAdapter(conn, f.logger), nil

	// Search Engines
	case entities.TypeElasticsearch:
		return search.NewElasticsearchAdapter(conn, f.logger), nil
	case entities.TypeSolr:
		return search.NewSolrAdapter(conn, f.logger), nil
	case entities.TypeTypesense:
		return search.NewTypesenseAdapter(conn, f.logger), nil

	default:
		return nil, &AdapterError{
			Code:    "UNSUPPORTED_DATABASE_TYPE",
			Message: "Unsupported database type: " + conn.Type,
		}
	}
}
