package aws

import (
	"context"
	"fmt"
	"github.com/queryflux/backend/internal/domain/entities"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// createDynamoDBClient creates a configured DynamoDB client
func (d *DynamoDBAdapter) createDynamoDBClient(conn *entities.Connection) (*dynamodb.Client, error) {
	// Parse connection string
	connParams, err := d.parseConnectionString(conn)
	if err != nil {
		return nil, err
	}

	// Create AWS config
	cfg, err := d.createAWSConfig(connParams)
	if err != nil {
		return nil, err
	}

	// Create DynamoDB client
	client := dynamodb.NewFromConfig(cfg)

	return client, nil
}

// DynamoDBConnectionParams holds parsed connection parameters
type DynamoDBConnectionParams struct {
	Region    string
	AccessKey string
	SecretKey string
	Endpoint  string
}

// parseConnectionString parses DynamoDB connection string
func (d *DynamoDBAdapter) parseConnectionString(conn *entities.Connection) (*DynamoDBConnectionParams, error) {
	connStr, err := conn.GetConnectionString()
	if err != nil {
		return nil, err
	}

	params := &DynamoDBConnectionParams{}

	// Parse connection string format: region=us-east-1;access_key=key;secret_key=secret
	parts := strings.Split(connStr, ";")
	for _, part := range parts {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}

		key := strings.TrimSpace(kv[0])
		value := strings.TrimSpace(kv[1])

		switch key {
		case "region":
			params.Region = value
		case "access_key":
			params.AccessKey = value
		case "secret_key":
			params.SecretKey = value
		case "endpoint":
			params.Endpoint = value
		}
	}

	// Validate required parameters
	if params.Region == "" {
		return nil, fmt.Errorf("region is required for DynamoDB connection")
	}

	return params, nil
}

// createAWSConfig creates AWS configuration
func (d *DynamoDBAdapter) createAWSConfig(params *DynamoDBConnectionParams) (aws.Config, error) {
	ctx := context.Background()

	// Configure AWS config options
	var opts []func(*config.LoadOptions) error

	// Set region
	opts = append(opts, config.WithRegion(params.Region))

	// Set credentials if provided
	if params.AccessKey != "" && params.SecretKey != "" {
		creds := credentials.NewStaticCredentialsProvider(
			params.AccessKey,
			params.SecretKey,
			"", // session token (optional)
		)
		opts = append(opts, config.WithCredentialsProvider(creds))
	}

	// Load AWS config
	cfg, err := config.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return aws.Config{}, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Set custom endpoint if provided (for local DynamoDB)
	if params.Endpoint != "" {
		cfg.BaseEndpoint = aws.String(params.Endpoint)
	}

	return cfg, nil
}