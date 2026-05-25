package entities

import (
	"fmt"
	"net/url"
	"strings"
)

// SQL Database Connection Strings

func (c *Connection) getPostgreSQLConnectionString() string {
	sslMode := "disable"
	if c.SSL {
		sslMode = "require"
	}

	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(c.Username, c.Password),
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   c.Database,
	}

	q := u.Query()
	q.Set("sslmode", sslMode)
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func (c *Connection) getMySQLConnectionString() string {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s", c.Username, c.Password, c.Host, c.Port, c.Database)

	params := make([]string, 0)
	if c.SSL {
		params = append(params, "tls=true")
	}
	for key, value := range c.Options {
		params = append(params, fmt.Sprintf("%s=%s", key, value))
	}
	if len(params) > 0 {
		dsn += "?" + params[0]
		for _, param := range params[1:] {
			dsn += "&" + param
		}
	}
	return dsn
}

func (c *Connection) getMariaDBConnectionString() string {
	return c.getMySQLConnectionString()
}

func (c *Connection) getSQLiteConnectionString() string {
	if c.Database == "" {
		return ":memory:"
	}
	return c.Database
}

func (c *Connection) getSQLServerConnectionString() string {
	connStr := fmt.Sprintf("server=%s;port=%d;database=%s;user id=%s;password=%s",
		c.Host, c.Port, c.Database, c.Username, c.Password)
	if c.SSL {
		connStr += ";encrypt=true"
	}
	for key, value := range c.Options {
		connStr += fmt.Sprintf(";%s=%s", key, value)
	}
	return connStr
}

func (c *Connection) getOracleConnectionString() string {
	connStr := fmt.Sprintf("%s/%s@%s:%d/%s", c.Username, c.Password, c.Host, c.Port, c.Database)

	if c.SSL {
		connStr += "?ssl=true"
	}

	if len(c.Options) > 0 {
		params := make([]string, 0)
		if c.SSL {
			params = append(params, "ssl=true")
		}
		for key, value := range c.Options {
			params = append(params, fmt.Sprintf("%s=%s", key, value))
		}
		if len(params) > 0 {
			if c.SSL {
				connStr += "&" + strings.Join(params[1:], "&")
			} else {
				connStr += "?" + strings.Join(params, "&")
			}
		}
	}
	return connStr
}

func (c *Connection) getCockroachDBConnectionString() string {
	return c.getPostgreSQLConnectionString()
}

func (c *Connection) getTimescaleDBConnectionString() string {
	return c.getPostgreSQLConnectionString()
}
