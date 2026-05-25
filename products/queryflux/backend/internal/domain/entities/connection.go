package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Connection represents a database connection configuration
type Connection struct {
	ID        string            `json:"id" db:"id"`
	UserID    string            `json:"user_id" db:"user_id"`
	Name      string            `json:"name" db:"name"`
	Type      string            `json:"type" db:"type"`
	Host      string            `json:"host" db:"host"`
	Port      int               `json:"port" db:"port"`
	Database  string            `json:"database" db:"database"`
	Username  string            `json:"username" db:"username"`
	Password  string            `json:"-" db:"password"` // Encrypted, never serialized
	SSL       bool              `json:"ssl" db:"ssl"`
	Options   map[string]string `json:"options" db:"options"`
	Status    string            `json:"status" db:"status"`
	LastUsed  *time.Time        `json:"last_used" db:"last_used"`
	CreatedAt time.Time         `json:"created_at" db:"created_at"`
	UpdatedAt time.Time         `json:"updated_at" db:"updated_at"`
}

// Connection types
const (
	// SQL Databases
	TypePostgreSQL  = "postgresql"
	TypeMySQL       = "mysql"
	TypeMariaDB     = "mariadb"
	TypeSQLite      = "sqlite"
	TypeSQLServer   = "sqlserver"
	TypeOracle      = "oracle"
	TypeCockroachDB = "cockroachdb"

	// NoSQL Databases
	TypeMongoDB   = "mongodb"
	TypeCassandra = "cassandra"
	TypeCouchDB   = "couchdb"
	TypeNeo4j     = "neo4j"
	TypeArangoDB  = "arangodb"

	// Key-Value & Cache
	TypeRedis     = "redis"
	TypeMemcached = "memcached"

	// Time Series & Analytics
	TypeInfluxDB    = "influxdb"
	TypeQuestDB     = "questdb"
	TypeTimescaleDB = "timescaledb"

	// Cloud & Managed Services
	TypeSupabase    = "supabase"
	TypePlanetScale = "planetscale"
	TypeNeon        = "neon"

	// AWS Services
	TypeAWSDynamoDB    = "aws-dynamodb"
	TypeAWSRDS         = "aws-rds"
	TypeAWSRedshift    = "aws-redshift"
	TypeAWSAurora      = "aws-aurora"
	TypeAWSDocumentDB  = "aws-documentdb"
	TypeAWSElastiCache = "aws-elasticache"
	TypeAWSNeptune     = "aws-neptune"
	TypeAWSKeyspaces   = "aws-keyspaces"
	TypeAWSTimestream  = "aws-timestream"
	TypeAWSAthena      = "aws-athena"
	TypeAWSOpenSearch  = "aws-opensearch"

	// Cloud Data Warehouses
	TypeSnowflake = "snowflake"
	TypeBigQuery  = "bigquery"
	TypeFirebolt  = "firebolt"

	// NewSQL Databases
	TypeYugabyteDB = "yugabytedb"
	TypeTiDB       = "tidb"
	TypeScyllaDB   = "scylladb"

	// Search Engines
	TypeElasticsearch = "elasticsearch"
	TypeSolr          = "solr"
	TypeTypesense     = "typesense"
)

// Connection statuses
const (
	StatusActive   = "active"
	StatusInactive = "inactive"
	StatusError    = "error"
)

// NewConnection creates a new database connection with validation
func NewConnection(userID, name, dbType, host string, port int, database, username, password string) (*Connection, error) {
	if err := validateConnectionParams(userID, name, dbType, host, port, database, username); err != nil {
		return nil, err
	}

	now := time.Now()
	return &Connection{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      name,
		Type:      dbType,
		Host:      host,
		Port:      port,
		Database:  database,
		Username:  username,
		Password:  password,
		SSL:       false,
		Options:   make(map[string]string),
		Status:    StatusInactive,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

// Validate validates the connection entity
func (c *Connection) Validate() error {
	if c.ID == "" {
		return fmt.Errorf("connection ID is required")
	}

	if c.UserID == "" {
		return fmt.Errorf("user ID is required")
	}

	return validateConnectionParams(c.UserID, c.Name, c.Type, c.Host, c.Port, c.Database, c.Username)
}

// Update updates connection configuration
func (c *Connection) Update(name, host string, port int, database, username, password string) error {
	if err := validateConnectionParams(c.UserID, name, c.Type, host, port, database, username); err != nil {
		return err
	}

	c.Name = name
	c.Host = host
	c.Port = port
	c.Database = database
	c.Username = username
	if password != "" {
		c.Password = password
	}
	c.UpdatedAt = time.Now()

	return nil
}

// SetStatus updates the connection status
func (c *Connection) SetStatus(status string) error {
	if !isValidStatus(status) {
		return fmt.Errorf("invalid status: %s", status)
	}

	c.Status = status
	c.UpdatedAt = time.Now()
	return nil
}

// MarkAsUsed updates the last used timestamp
func (c *Connection) MarkAsUsed() {
	now := time.Now()
	c.LastUsed = &now
	c.UpdatedAt = now
}

// SetSSL enables or disables SSL
func (c *Connection) SetSSL(enabled bool) {
	c.SSL = enabled
	c.UpdatedAt = time.Now()
}

// SetOption sets a connection option
func (c *Connection) SetOption(key, value string) {
	if c.Options == nil {
		c.Options = make(map[string]string)
	}
	c.Options[key] = value
	c.UpdatedAt = time.Now()
}

// IsActive checks if connection is active
func (c *Connection) IsActive() bool {
	return c.Status == StatusActive
}
