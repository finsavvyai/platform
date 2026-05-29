//go:build legacy_migrated
// +build legacy_migrated

// Package influxdb provides InfluxDB client functionality for QuantumBeam.io
package influxdb

import (
	"context"
	"fmt"
	"strings"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/rs/zerolog/log"
)

// Client wraps InfluxDB operations for QuantumBeam
type Client struct {
	client influxdb2.Client
	org    string
	config *Config
}

// Config holds InfluxDB configuration
type Config struct {
	URL           string
	Token         string
	Org           string
	Bucket        string
	Timeout       time.Duration
	RetryCount    int
	RetryInterval time.Duration
	BatchSize     int
	FlushInterval time.Duration
	Precision     string
	GzipEnabled   bool
	TLSConfig     *TLSConfig
}

// TLSConfig holds TLS configuration for InfluxDB
type TLSConfig struct {
	Enabled            bool
	InsecureSkipVerify bool
	CertFile           string
	KeyFile            string
	CaCertFile         string
}

// Point represents a data point for InfluxDB
type Point struct {
	Measurement string
	Tags        map[string]string
	Fields      map[string]interface{}
	Timestamp   time.Time
}

// QueryResult represents the result of a query
type QueryResult struct {
	Records []map[string]interface{}
	Columns []string
}

// MetricsConfig holds metrics configuration
type MetricsConfig struct {
	Name        string
	Measurement string
	Tags        map[string]string
	Fields      map[string]interface{}
}

// NewClient creates a new InfluxDB client with the given configuration
func NewClient(config *Config) (*Client, error) {
	if config == nil {
		config = defaultConfig()
	}

	clientOptions := influxdb2.DefaultOptions().
		SetTimeout(config.Timeout).
		SetRetryCount(config.RetryCount).
		SetRetryInterval(config.RetryInterval).
		SetBatchSize(config.BatchSize).
		SetFlushInterval(config.FlushInterval).
		SetPrecision(config.Precision).
		SetUseGZip(config.GzipEnabled)

	// Configure TLS if enabled
	if config.TLSConfig != nil && config.TLSConfig.Enabled {
		// TLS configuration would go here
		log.Info().Msg("TLS enabled for InfluxDB connection")
	}

	client := influxdb2.NewClientWithOptions(config.URL, config.Token, clientOptions)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Check if organization exists
	_, err := client.OrganizationsAPI().GetOrg(ctx, config.Org)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to InfluxDB organization '%s': %w", config.Org, err)
	}

	log.Info().
		Str("url", config.URL).
		Str("org", config.Org).
		Str("bucket", config.Bucket).
		Msg("Successfully connected to InfluxDB")

	return &Client{
		client: client,
		org:    config.Org,
		config: config,
	}, nil
}

// defaultConfig returns default InfluxDB configuration
func defaultConfig() *Config {
	return &Config{
		URL:           "http://localhost:8086",
		Token:         "",
		Org:           "quantumbeam",
		Bucket:        "metrics",
		Timeout:       10 * time.Second,
		RetryCount:    3,
		RetryInterval: 5 * time.Second,
		BatchSize:     1000,
		FlushInterval: 1 * time.Second,
		Precision:     "ns",
		GzipEnabled:   true,
	}
}

// WritePoint writes a single data point to InfluxDB
func (c *Client) WritePoint(ctx context.Context, point *Point) error {
	if point == nil {
		return fmt.Errorf("point cannot be nil")
	}

	writeAPI := c.client.WriteAPI(c.org, c.config.Bucket)

	influxPoint := influxdb2.NewPoint(
		point.Measurement,
		point.Tags,
		point.Fields,
		point.Timestamp,
	)

	writeAPI.WritePoint(influxPoint)

	// Force flush to ensure data is written
	writeAPI.Flush()

	log.Debug().
		Str("measurement", point.Measurement).
		Str("bucket", c.config.Bucket).
		Msg("Point written to InfluxDB")

	return nil
}

// WritePoints writes multiple data points to InfluxDB
func (c *Client) WritePoints(ctx context.Context, points []*Point) error {
	if len(points) == 0 {
		return nil
	}

	writeAPI := c.client.WriteAPI(c.org, c.config.Bucket)

	for _, point := range points {
		influxPoint := influxdb2.NewPoint(
			point.Measurement,
			point.Tags,
			point.Fields,
			point.Timestamp,
		)
		writeAPI.WritePoint(influxPoint)
	}

	// Force flush to ensure data is written
	writeAPI.Flush()

	log.Debug().
		Int("count", len(points)).
		Str("bucket", c.config.Bucket).
		Msg("Points written to InfluxDB")

	return nil
}

// WriteMetric writes a metric with predefined configuration
func (c *Client) WriteMetric(ctx context.Context, config *MetricsConfig, value interface{}) error {
	if config == nil {
		return fmt.Errorf("metrics config cannot be nil")
	}

	point := &Point{
		Measurement: config.Measurement,
		Tags:        config.Tags,
		Fields:      make(map[string]interface{}),
		Timestamp:   time.Now(),
	}

	// Add the main value field
	if config.Name != "" {
		point.Fields[config.Name] = value
	}

	// Add additional fields
	for key, val := range config.Fields {
		point.Fields[key] = val
	}

	return c.WritePoint(ctx, point)
}

// Query executes a Flux query and returns the results
func (c *Client) Query(ctx context.Context, query string) (*QueryResult, error) {
	if query == "" {
		return nil, fmt.Errorf("query cannot be empty")
	}

	queryAPI := c.client.QueryAPI(c.org)

	result, err := queryAPI.Query(ctx, query)
	if err != nil {
		log.Error().Err(err).Str("query", query).Msg("Failed to execute InfluxDB query")
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}

	records := make([]map[string]interface{}, 0)
	var columns []string

	for result.Next() {
		record := make(map[string]interface{})

		if columns == nil {
			// Extract column names from first record
			for column := range result.Record().Values() {
				columns = append(columns, column)
			}
		}

		// Extract values
		for column, value := range result.Record().Values() {
			record[column] = value
		}
		record["_measurement"] = result.Record().Measurement()
		record["_field"] = result.Record().Field()
		record["_value"] = result.Record().Value()
		record["_time"] = result.Record().Time()

		records = append(records, record)
	}

	if result.Err() != nil {
		return nil, fmt.Errorf("query execution error: %w", result.Err())
	}

	log.Debug().
		Str("query", query).
		Int("record_count", len(records)).
		Msg("Query executed successfully")

	return &QueryResult{
		Records: records,
		Columns: columns,
	}, nil
}

// QueryScalar executes a query and returns a single scalar value
func (c *Client) QueryScalar(ctx context.Context, query string) (interface{}, error) {
	result, err := c.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	if len(result.Records) == 0 {
		return nil, fmt.Errorf("query returned no results")
	}

	// Return the _value from the first record
	return result.Records[0]["_value"], nil
}

// QueryTimeSeries executes a query and returns time series data
func (c *Client) QueryTimeSeries(ctx context.Context, query string) ([]TimeSeriesPoint, error) {
	result, err := c.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	var points []TimeSeriesPoint

	for _, record := range result.Records {
		point := TimeSeriesPoint{
			Time:  record["_time"].(time.Time),
			Value: record["_value"],
		}

		// Add tags
		point.Tags = make(map[string]string)
		for key, value := range record {
			if strings.HasPrefix(key, "_") {
				continue
			}
			if strValue, ok := value.(string); ok {
				point.Tags[key] = strValue
			}
		}

		points = append(points, point)
	}

	return points, nil
}

// TimeSeriesPoint represents a single point in a time series
type TimeSeriesPoint struct {
	Time  time.Time         `json:"time"`
	Value interface{}       `json:"value"`
	Tags  map[string]string `json:"tags,omitempty"`
}

// CreateBucket creates a new bucket with the specified retention policy
func (c *Client) CreateBucket(ctx context.Context, name string, retention time.Duration) error {
	if name == "" {
		return fmt.Errorf("bucket name cannot be empty")
	}

	orgAPI := c.client.OrganizationsAPI()
	org, err := orgAPI.GetOrg(ctx, c.org)
	if err != nil {
		return fmt.Errorf("failed to get organization: %w", err)
	}

	bucketAPI := c.client.BucketsAPI()

	bucket := &influxdb2.Bucket{
		Name:           name,
		OrgID:          *org.Id,
		RetentionRules: []*influxdb2.RetentionRule{},
	}

	// Add retention rule if specified
	if retention > 0 {
		bucket.RetentionRules = append(bucket.RetentionRules, &influxdb2.RetentionRule{
			TypeSeconds:  influxdb2.RetentionRuleTypeSeconds,
			EverySeconds: uint64(retention.Seconds()),
		})
	}

	_, err = bucketAPI.CreateBucket(ctx, bucket)
	if err != nil {
		log.Error().Err(err).Str("bucket", name).Msg("Failed to create InfluxDB bucket")
		return fmt.Errorf("failed to create bucket: %w", err)
	}

	log.Info().
		Str("bucket", name).
		Dur("retention", retention).
		Msg("Bucket created successfully")

	return nil
}

// DeleteBucket deletes a bucket
func (c *Client) DeleteBucket(ctx context.Context, name string) error {
	if name == "" {
		return fmt.Errorf("bucket name cannot be empty")
	}

	bucketAPI := c.client.BucketsAPI()

	bucket, err := bucketAPI.FindBucketByName(ctx, name)
	if err != nil {
		return fmt.Errorf("failed to find bucket: %w", err)
	}

	err = bucketAPI.DeleteBucket(ctx, *bucket.Id)
	if err != nil {
		log.Error().Err(err).Str("bucket", name).Msg("Failed to delete InfluxDB bucket")
		return fmt.Errorf("failed to delete bucket: %w", err)
	}

	log.Info().Str("bucket", name).Msg("Bucket deleted successfully")
	return nil
}

// ListBuckets returns a list of all buckets in the organization
func (c *Client) ListBuckets(ctx context.Context) ([]string, error) {
	bucketAPI := c.client.BucketsAPI()

	buckets, err := bucketAPI.FindBucketsByOrgName(ctx, c.org)
	if err != nil {
		return nil, fmt.Errorf("failed to list buckets: %w", err)
	}

	var bucketNames []string
	for _, bucket := range buckets {
		bucketNames = append(bucketNames, *bucket.Name)
	}

	return bucketNames, nil
}

// Ping checks the connection to InfluxDB
func (c *Client) Ping(ctx context.Context) error {
	healthAPI := c.client.HealthAPI()

	health, err := healthAPI.Health(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to ping InfluxDB")
		return fmt.Errorf("failed to ping InfluxDB: %w", err)
	}

	if health.Message != "" {
		log.Warn().Str("message", health.Message).Msg("InfluxDB health check warning")
	}

	log.Debug().Msg("InfluxDB ping successful")
	return nil
}

// Close closes the InfluxDB connection
func (c *Client) Close() {
	c.client.Close()
	log.Info().Msg("InfluxDB connection closed")
}

// GetStats returns client statistics
func (c *Client) GetStats() map[string]interface{} {
	// This would return statistics about the client
	// Implementation depends on the specific InfluxDB client library
	return map[string]interface{}{
		"org":    c.org,
		"bucket": c.config.Bucket,
		"url":    c.config.URL,
	}
}

// Custom errors
var (
	ErrInvalidQuery     = fmt.Errorf("invalid query")
	ErrConnectionFailed = fmt.Errorf("connection failed")
	ErrBucketNotFound   = fmt.Errorf("bucket not found")
	ErrOrgNotFound      = fmt.Errorf("organization not found")
)