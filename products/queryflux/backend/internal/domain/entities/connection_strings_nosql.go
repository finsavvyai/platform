package entities

import (
	"fmt"
	"net/url"
	"strconv"
)

// NoSQL Database Connection Strings

func (c *Connection) getMongoDBConnectionString() string {
	scheme := "mongodb"
	if c.SSL {
		scheme = "mongodb+srv"
	}

	u := &url.URL{
		Scheme: scheme,
		User:   url.UserPassword(c.Username, c.Password),
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   c.Database,
	}

	q := u.Query()
	if c.SSL {
		q.Set("ssl", "true")
	}
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func (c *Connection) getCassandraConnectionString() string {
	connStr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	if c.Username != "" && c.Password != "" {
		connStr = fmt.Sprintf("%s:%s@%s", c.Username, c.Password, connStr)
	}
	if c.SSL {
		connStr += "?ssl=true"
	}
	return connStr
}

func (c *Connection) getCouchDBConnectionString() string {
	scheme := "http"
	if c.SSL {
		scheme = "https"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
	}
	if c.Username != "" && c.Password != "" {
		u.User = url.UserPassword(c.Username, c.Password)
	}
	if c.Database != "" {
		u.Path = "/" + c.Database
	}
	return u.String()
}

func (c *Connection) getNeo4jConnectionString() string {
	scheme := "bolt"
	if c.SSL {
		scheme = "bolt+s"
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

func (c *Connection) getArangoDBConnectionString() string {
	scheme := "http"
	if c.SSL {
		scheme = "https"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
	}
	if c.Username != "" && c.Password != "" {
		u.User = url.UserPassword(c.Username, c.Password)
	}
	if c.Database != "" {
		u.Path = "/_db/" + c.Database
	}
	return u.String()
}

func (c *Connection) getScyllaDBConnectionString() string {
	connStr := fmt.Sprintf("%s:%d", c.Host, c.Port)
	if c.Username != "" && c.Password != "" {
		connStr = fmt.Sprintf("%s:%s@%s", c.Username, c.Password, connStr)
	}
	if c.SSL {
		connStr += "?ssl=true"
	}
	return connStr
}

// Key-Value & Cache Connection Strings

func (c *Connection) getRedisConnectionString() string {
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
	if c.Database != "" {
		if db, err := strconv.Atoi(c.Database); err == nil {
			u.Path = fmt.Sprintf("/%d", db)
		}
	}
	return u.String()
}

func (c *Connection) getMemcachedConnectionString() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}
