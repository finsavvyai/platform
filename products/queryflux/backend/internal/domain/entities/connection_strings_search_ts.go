package entities

import (
	"fmt"
	"net/url"
)

// Time Series Database Connection Strings

func (c *Connection) getInfluxDBConnectionString() string {
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

	q := u.Query()
	if c.Database != "" {
		q.Set("db", c.Database)
	}
	for key, value := range c.Options {
		q.Set(key, value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func (c *Connection) getQuestDBConnectionString() string {
	return c.getPostgreSQLConnectionString()
}

// NewSQL Database Connection Strings

func (c *Connection) getYugabyteDBConnectionString() string {
	return c.getPostgreSQLConnectionString()
}

func (c *Connection) getTiDBConnectionString() string {
	return c.getMySQLConnectionString()
}

// Search Engine Connection Strings

func (c *Connection) getElasticsearchConnectionString() string {
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
	if c.Database != "" {
		u.Path = "/" + c.Database
	}
	return u.String()
}

func (c *Connection) getSolrConnectionString() string {
	scheme := "https"
	if !c.SSL {
		scheme = "http"
	}

	u := &url.URL{
		Scheme: scheme,
		Host:   fmt.Sprintf("%s:%d", c.Host, c.Port),
		Path:   "/solr",
	}
	if c.Username != "" && c.Password != "" {
		u.User = url.UserPassword(c.Username, c.Password)
	}
	if c.Database != "" {
		u.Path += "/" + c.Database
	}
	return u.String()
}

func (c *Connection) getTypesenseConnectionString() string {
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
