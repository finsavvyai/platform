package nosql

import (
	"github.com/queryflux/backend/internal/domain/entities"

	"github.com/sirupsen/logrus"
)

// NewMongoDBAdapter creates a new MongoDB adapter
func NewMongoDBAdapter(conn *entities.Connection, logger *logrus.Logger) *MongoDBAdapter {
	return &MongoDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewCassandraAdapter creates a new Cassandra adapter
func NewCassandraAdapter(conn *entities.Connection, logger *logrus.Logger) *CassandraAdapter {
	return &CassandraAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewCouchDBAdapter creates a new CouchDB adapter
func NewCouchDBAdapter(conn *entities.Connection, logger *logrus.Logger) *CouchDBAdapter {
	return &CouchDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewNeo4jAdapter creates a new Neo4j adapter
func NewNeo4jAdapter(conn *entities.Connection, logger *logrus.Logger) *Neo4jAdapter {
	return &Neo4jAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewArangoDBAdapter creates a new ArangoDB adapter
func NewArangoDBAdapter(conn *entities.Connection, logger *logrus.Logger) *ArangoDBAdapter {
	return &ArangoDBAdapter{
		conn:   conn,
		logger: logger,
	}
}

// NewScyllaDBAdapter creates a new ScyllaDB adapter
func NewScyllaDBAdapter(conn *entities.Connection, logger *logrus.Logger) *ScyllaDBAdapter {
	return &ScyllaDBAdapter{
		conn:   conn,
		logger: logger,
	}
}
