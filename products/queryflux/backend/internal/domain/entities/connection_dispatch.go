package entities

import "fmt"

// GetConnectionString returns a connection string for the database
func (c *Connection) GetConnectionString() (string, error) {
	switch c.Type {
	case TypePostgreSQL:
		return c.getPostgreSQLConnectionString(), nil
	case TypeMySQL:
		return c.getMySQLConnectionString(), nil
	case TypeMariaDB:
		return c.getMariaDBConnectionString(), nil
	case TypeSQLite:
		return c.getSQLiteConnectionString(), nil
	case TypeSQLServer:
		return c.getSQLServerConnectionString(), nil
	case TypeOracle:
		return c.getOracleConnectionString(), nil
	case TypeCockroachDB:
		return c.getCockroachDBConnectionString(), nil
	case TypeMongoDB:
		return c.getMongoDBConnectionString(), nil
	case TypeCassandra:
		return c.getCassandraConnectionString(), nil
	case TypeCouchDB:
		return c.getCouchDBConnectionString(), nil
	case TypeNeo4j:
		return c.getNeo4jConnectionString(), nil
	case TypeArangoDB:
		return c.getArangoDBConnectionString(), nil
	case TypeRedis:
		return c.getRedisConnectionString(), nil
	case TypeMemcached:
		return c.getMemcachedConnectionString(), nil
	case TypeInfluxDB:
		return c.getInfluxDBConnectionString(), nil
	case TypeQuestDB:
		return c.getQuestDBConnectionString(), nil
	case TypeTimescaleDB:
		return c.getTimescaleDBConnectionString(), nil
	case TypeSupabase:
		return c.getSupabaseConnectionString(), nil
	case TypePlanetScale:
		return c.getPlanetScaleConnectionString(), nil
	case TypeNeon:
		return c.getNeonConnectionString(), nil
	case TypeAWSDynamoDB:
		return c.getAWSDynamoDBConnectionString(), nil
	case TypeAWSRDS:
		return c.getAWSRDSConnectionString(), nil
	case TypeAWSRedshift:
		return c.getAWSRedshiftConnectionString(), nil
	case TypeAWSAurora:
		return c.getAWSAuroraConnectionString(), nil
	case TypeAWSDocumentDB:
		return c.getAWSDocumentDBConnectionString(), nil
	case TypeAWSElastiCache:
		return c.getAWSElastiCacheConnectionString(), nil
	case TypeAWSNeptune:
		return c.getAWSNeptuneConnectionString(), nil
	case TypeAWSKeyspaces:
		return c.getAWSKeyspacesConnectionString(), nil
	case TypeAWSTimestream:
		return c.getAWSTimestreamConnectionString(), nil
	case TypeAWSAthena:
		return c.getAWSAthenaConnectionString(), nil
	case TypeAWSOpenSearch:
		return c.getAWSOpenSearchConnectionString(), nil
	case TypeSnowflake:
		return c.getSnowflakeConnectionString(), nil
	case TypeBigQuery:
		return c.getBigQueryConnectionString(), nil
	case TypeFirebolt:
		return c.getFireboltConnectionString(), nil
	case TypeYugabyteDB:
		return c.getYugabyteDBConnectionString(), nil
	case TypeTiDB:
		return c.getTiDBConnectionString(), nil
	case TypeScyllaDB:
		return c.getScyllaDBConnectionString(), nil
	case TypeElasticsearch:
		return c.getElasticsearchConnectionString(), nil
	case TypeSolr:
		return c.getSolrConnectionString(), nil
	case TypeTypesense:
		return c.getTypesenseConnectionString(), nil
	default:
		return "", fmt.Errorf("unsupported database type: %s", c.Type)
	}
}
