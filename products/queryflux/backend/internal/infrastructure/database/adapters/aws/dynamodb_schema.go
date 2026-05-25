package aws

import (
	"context"
	adaptertypes "github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

// GetSchema retrieves DynamoDB schema information
func (d *DynamoDBAdapter) GetSchema(ctx context.Context) (*adaptertypes.SchemaInfo, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.client == nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to DynamoDB",
		}
	}

	// List all tables
	listInput := &dynamodb.ListTablesInput{}
	listResult, err := d.client.ListTables(ctx, listInput)
	if err != nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "SCHEMA_QUERY_FAILED",
			Message: "Failed to list DynamoDB tables",
			Details: err.Error(),
		}
	}

	var tables []adaptertypes.TableInfo
	for _, tableName := range listResult.TableNames {
		// Get detailed table information
		tableInfo, err := d.GetTableInfo(ctx, tableName)
		if err != nil {
			d.logger.Warnf("Failed to get table info for %s: %v", tableName, err)
			// Continue with basic info
			tableInfo = &adaptertypes.TableInfo{
				Name:   tableName,
				Schema: "dynamodb",
			}
		}

		tables = append(tables, *tableInfo)
	}

	return &adaptertypes.SchemaInfo{
		Tables: tables,
	}, nil
}

// GetTableInfo retrieves information about a specific DynamoDB table
func (d *DynamoDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*adaptertypes.TableInfo, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.client == nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to DynamoDB",
		}
	}

	// Describe table
	input := &dynamodb.DescribeTableInput{
		TableName: aws.String(tableName),
	}

	result, err := d.client.DescribeTable(ctx, input)
	if err != nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "TABLE_DESCRIBE_FAILED",
			Message: "Failed to describe DynamoDB table",
			Details: err.Error(),
		}
	}

	table := result.Table

	// Convert attribute definitions to columns
	var columns []adaptertypes.ColumnInfo
	for _, attr := range table.AttributeDefinitions {
		column := adaptertypes.ColumnInfo{
			Name:         *attr.AttributeName,
			Type:         string(attr.AttributeType),
			Nullable:     true, // DynamoDB attributes are generally nullable
			IsPrimaryKey: false,
		}

		// Check if this attribute is part of the primary key
		for _, keyElement := range table.KeySchema {
			if *keyElement.AttributeName == *attr.AttributeName {
				column.IsPrimaryKey = true
				break
			}
		}

		columns = append(columns, column)
	}

	// Convert global secondary indexes to index info
	var indexes []adaptertypes.IndexInfo
	for _, gsi := range table.GlobalSecondaryIndexes {
		var indexColumns []string
		for _, keyElement := range gsi.KeySchema {
			indexColumns = append(indexColumns, *keyElement.AttributeName)
		}

		indexes = append(indexes, adaptertypes.IndexInfo{
			Name:    *gsi.IndexName,
			Columns: indexColumns,
			Unique:  false, // GSIs are not unique by default
		})
	}

	// Convert local secondary indexes to index info
	for _, lsi := range table.LocalSecondaryIndexes {
		var indexColumns []string
		for _, keyElement := range lsi.KeySchema {
			indexColumns = append(indexColumns, *keyElement.AttributeName)
		}

		indexes = append(indexes, adaptertypes.IndexInfo{
			Name:    *lsi.IndexName,
			Columns: indexColumns,
			Unique:  false, // LSIs are not unique by default
		})
	}

	return &adaptertypes.TableInfo{
		Name:    tableName,
		Schema:  "dynamodb",
		Columns: columns,
		Indexes: indexes,
	}, nil
}