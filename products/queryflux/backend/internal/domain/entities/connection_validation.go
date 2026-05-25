package entities

import "fmt"

// validateConnectionParams validates connection parameters
func validateConnectionParams(userID, name, dbType, host string, port int, database, username string) error {
	if userID == "" {
		return fmt.Errorf("user ID is required")
	}
	if name == "" {
		return fmt.Errorf("connection name is required")
	}
	if len(name) > 100 {
		return fmt.Errorf("connection name must be less than 100 characters")
	}
	if !isValidType(dbType) {
		return fmt.Errorf("invalid database type: %s", dbType)
	}
	if host == "" {
		return fmt.Errorf("host is required")
	}
	if port <= 0 || port > 65535 {
		return fmt.Errorf("port must be between 1 and 65535")
	}
	if database == "" && dbType != TypeRedis {
		return fmt.Errorf("database name is required for %s", dbType)
	}
	if username == "" && dbType != TypeRedis {
		return fmt.Errorf("username is required for %s", dbType)
	}
	return nil
}

func isValidType(dbType string) bool {
	validTypes := map[string]bool{
		TypePostgreSQL: true, TypeMySQL: true, TypeMariaDB: true,
		TypeSQLite: true, TypeSQLServer: true, TypeOracle: true,
		TypeCockroachDB: true, TypeMongoDB: true, TypeCassandra: true,
		TypeCouchDB: true, TypeNeo4j: true, TypeArangoDB: true,
		TypeScyllaDB: true, TypeRedis: true, TypeMemcached: true,
		TypeInfluxDB: true, TypeQuestDB: true, TypeTimescaleDB: true,
		TypeSupabase: true, TypePlanetScale: true, TypeNeon: true,
		TypeAWSDynamoDB: true, TypeAWSRDS: true, TypeAWSRedshift: true,
		TypeAWSAurora: true, TypeAWSDocumentDB: true, TypeAWSElastiCache: true,
		TypeAWSNeptune: true, TypeAWSKeyspaces: true, TypeAWSTimestream: true,
		TypeAWSAthena: true, TypeAWSOpenSearch: true, TypeSnowflake: true,
		TypeBigQuery: true, TypeFirebolt: true, TypeYugabyteDB: true,
		TypeTiDB: true, TypeElasticsearch: true, TypeSolr: true,
		TypeTypesense: true,
	}
	return validTypes[dbType]
}

func isValidStatus(status string) bool {
	return status == StatusActive || status == StatusInactive || status == StatusError
}
