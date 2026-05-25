package entities

import (
	"fmt"
	"net/url"
	"strings"
)

// Cloud & Managed Service Connection Strings

func (c *Connection) getSupabaseConnectionString() string {
	u := &url.URL{
		Scheme: "postgresql",
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

func (c *Connection) getPlanetScaleConnectionString() string {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s", c.Username, c.Password, c.Host, c.Port, c.Database)

	params := []string{"tls=true", "interpolateParams=true"}
	for key, value := range c.Options {
		params = append(params, fmt.Sprintf("%s=%s", key, value))
	}
	if len(params) > 0 {
		dsn += "?" + strings.Join(params, "&")
	}
	return dsn
}

func (c *Connection) getNeonConnectionString() string {
	u := &url.URL{
		Scheme: "postgresql",
		User:   url.UserPassword(c.Username, c.Password),
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   c.Database,
	}

	q := u.Query()
	q.Set("sslmode", "require")
	q.Set("connect_timeout", "10")
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// Cloud Data Warehouse Connection Strings

func (c *Connection) getSnowflakeConnectionString() string {
	connStr := fmt.Sprintf("%s:%s@%s/%s", c.Username, c.Password, c.Host, c.Database)

	if warehouse := c.Options["warehouse"]; warehouse != "" {
		connStr += fmt.Sprintf("?warehouse=%s", warehouse)
	}
	if role := c.Options["role"]; role != "" {
		if warehouse := c.Options["warehouse"]; warehouse != "" {
			connStr += fmt.Sprintf("&role=%s", role)
		} else {
			connStr += fmt.Sprintf("?role=%s", role)
		}
	}
	return connStr
}

func (c *Connection) getBigQueryConnectionString() string {
	projectID := c.Host
	if projectID == "" {
		projectID = "your-project-id"
	}

	connStr := fmt.Sprintf("project_id=%s", projectID)
	if c.Database != "" {
		connStr += fmt.Sprintf(";dataset=%s", c.Database)
	}
	if c.Username != "" && c.Password != "" {
		connStr += fmt.Sprintf(";credentials=%s", c.Password)
	}
	for key, value := range c.Options {
		connStr += fmt.Sprintf(";%s=%s", key, value)
	}
	return connStr
}

func (c *Connection) getFireboltConnectionString() string {
	return c.getPostgreSQLConnectionString()
}
