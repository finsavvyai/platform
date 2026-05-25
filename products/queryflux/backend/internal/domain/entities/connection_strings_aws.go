package entities

import (
	"fmt"
	"net/url"
)

// AWS Service Connection Strings

func (c *Connection) getAWSDynamoDBConnectionString() string {
	region := c.Host
	if region == "" {
		region = "us-east-1"
	}

	connStr := fmt.Sprintf("region=%s", region)
	if c.Username != "" && c.Password != "" {
		connStr += fmt.Sprintf(";access_key=%s;secret_key=%s", c.Username, c.Password)
	}
	for key, value := range c.Options {
		connStr += fmt.Sprintf(";%s=%s", key, value)
	}
	return connStr
}

func (c *Connection) getAWSRDSConnectionString() string {
	engine := c.Options["engine"]
	switch engine {
	case "postgres":
		return c.getPostgreSQLConnectionString()
	case "mysql":
		return c.getMySQLConnectionString()
	case "mariadb":
		return c.getMariaDBConnectionString()
	case "oracle":
		return c.getOracleConnectionString()
	case "sqlserver":
		return c.getSQLServerConnectionString()
	default:
		return c.getPostgreSQLConnectionString()
	}
}

func (c *Connection) getAWSRedshiftConnectionString() string {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(c.Username, c.Password),
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   c.Database,
	}

	q := u.Query()
	q.Set("sslmode", "require")
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func (c *Connection) getAWSAuroraConnectionString() string {
	engine := c.Options["engine"]
	switch engine {
	case "aurora-mysql":
		return c.getMySQLConnectionString()
	case "aurora-postgresql":
		return c.getPostgreSQLConnectionString()
	default:
		return c.getPostgreSQLConnectionString()
	}
}

func (c *Connection) getAWSDocumentDBConnectionString() string {
	u := &url.URL{
		Scheme: "mongodb",
		User:   url.UserPassword(c.Username, c.Password),
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   c.Database,
	}

	q := u.Query()
	q.Set("ssl", "true")
	q.Set("replicaSet", "rs0")
	q.Set("readPreference", "secondaryPreferred")
	q.Set("retryWrites", "false")
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func (c *Connection) getAWSElastiCacheConnectionString() string {
	scheme := "redis"
	if c.SSL {
		scheme = "rediss"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
	}
	if c.Password != "" {
		u.User = url.UserPassword("", c.Password)
	}
	return u.String()
}

func (c *Connection) getAWSNeptuneConnectionString() string {
	scheme := "wss"
	if !c.SSL {
		scheme = "ws"
	}

	endpoint := c.Options["endpoint"]
	if endpoint == "" {
		endpoint = "gremlin"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   "/" + endpoint,
	}
	return u.String()
}

func (c *Connection) getAWSKeyspacesConnectionString() string {
	connStr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	if c.Username != "" && c.Password != "" {
		connStr = fmt.Sprintf("%s:%s@%s", c.Username, c.Password, connStr)
	}
	connStr += "?ssl=true"
	return connStr
}

func (c *Connection) getAWSTimestreamConnectionString() string {
	region := c.Host
	if region == "" {
		region = "us-east-1"
	}

	connStr := fmt.Sprintf("region=%s", region)
	if c.Username != "" && c.Password != "" {
		connStr += fmt.Sprintf(";access_key=%s;secret_key=%s", c.Username, c.Password)
	}
	if c.Database != "" {
		connStr += fmt.Sprintf(";database=%s", c.Database)
	}
	return connStr
}

func (c *Connection) getAWSAthenaConnectionString() string {
	region := c.Host
	if region == "" {
		region = "us-east-1"
	}

	connStr := fmt.Sprintf("region=%s", region)
	if c.Username != "" && c.Password != "" {
		connStr += fmt.Sprintf(";access_key=%s;secret_key=%s", c.Username, c.Password)
	}
	if c.Database != "" {
		connStr += fmt.Sprintf(";database=%s", c.Database)
	}
	if outputLocation := c.Options["s3_output_location"]; outputLocation != "" {
		connStr += fmt.Sprintf(";s3_output_location=%s", outputLocation)
	}
	return connStr
}

func (c *Connection) getAWSOpenSearchConnectionString() string {
	scheme := "https"
	if !c.SSL {
		scheme = "http"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
	}
	if c.Username != "" && c.Password != "" {
		u.User = url.UserPassword(c.Username, c.Password)
	}
	return u.String()
}
