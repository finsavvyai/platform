package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	adaptertypes "github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// ExecuteQuery executes a DynamoDB operation and returns results
func (d *DynamoDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*adaptertypes.QueryResult, error) {
	d.mutex.RLock()
	defer d.mutex.RUnlock()

	if d.client == nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "NOT_CONNECTED",
			Message: "Not connected to DynamoDB",
		}
	}

	// Trim and validate query
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &adaptertypes.AdapterError{
			Code:    "EMPTY_QUERY",
			Message: "Query cannot be empty",
		}
	}

	// Parse DynamoDB operation from query
	operation, err := d.parseDynamoDBOperation(query)
	if err != nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "QUERY_PARSE_FAILED",
			Message: "Failed to parse DynamoDB operation",
			Details: err.Error(),
		}
	}

	// Execute the operation
	result, err := d.executeDynamoDBOperation(ctx, operation)
	if err != nil {
		return nil, &adaptertypes.AdapterError{
			Code:    "QUERY_EXECUTION_FAILED",
			Message: "Failed to execute DynamoDB operation",
			Details: err.Error(),
		}
	}

	return result, nil
}

// DynamoDBOperation represents a parsed DynamoDB operation
type DynamoDBOperation struct {
	Type      string                 `json:"type"` // scan, query, get_item, put_item, update_item, delete_item
	TableName string                 `json:"table_name"`
	Key       map[string]interface{} `json:"key,omitempty"`
	Item      map[string]interface{} `json:"item,omitempty"`
	Filter    map[string]interface{} `json:"filter,omitempty"`
	Index     string                 `json:"index,omitempty"`
	Limit     int32                  `json:"limit,omitempty"`
}

// parseDynamoDBOperation parses a DynamoDB query string into an operation
func (d *DynamoDBAdapter) parseDynamoDBOperation(query string) (*DynamoDBOperation, error) {
	var operation DynamoDBOperation

	// Try to parse as JSON first
	if err := json.Unmarshal([]byte(query), &operation); err == nil {
		return &operation, nil
	}

	// Parse simple command-like syntax
	parts := strings.Fields(query)
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid DynamoDB operation format")
	}

	operation.Type = strings.ToLower(parts[0])
	operation.TableName = parts[1]

	// Set default limit for scan/query operations
	if operation.Type == "scan" || operation.Type == "query" {
		operation.Limit = 100
	}

	return &operation, nil
}

// executeDynamoDBOperation executes a parsed DynamoDB operation
func (d *DynamoDBAdapter) executeDynamoDBOperation(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	switch op.Type {
	case "scan":
		return d.executeScan(ctx, op)
	case "query":
		return d.executeQuery(ctx, op)
	case "get_item":
		return d.executeGetItem(ctx, op)
	case "put_item":
		return d.executePutItem(ctx, op)
	case "update_item":
		return d.executeUpdateItem(ctx, op)
	case "delete_item":
		return d.executeDeleteItem(ctx, op)
	case "list_tables":
		return d.executeListTables(ctx)
	default:
		return nil, fmt.Errorf("unsupported DynamoDB operation: %s", op.Type)
	}
}

// executeScan executes a DynamoDB Scan operation
func (d *DynamoDBAdapter) executeScan(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(op.TableName),
	}

	if op.Limit > 0 {
		input.Limit = aws.Int32(op.Limit)
	}

	result, err := d.client.Scan(ctx, input)
	if err != nil {
		return nil, err
	}

	return d.convertDynamoDBResult(result.Items, result.Count), nil
}

// executeQuery executes a DynamoDB Query operation
func (d *DynamoDBAdapter) executeQuery(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	input := &dynamodb.QueryInput{
		TableName: aws.String(op.TableName),
	}

	if op.Index != "" {
		input.IndexName = aws.String(op.Index)
	}

	if op.Limit > 0 {
		input.Limit = aws.Int32(op.Limit)
	}

	result, err := d.client.Query(ctx, input)
	if err != nil {
		return nil, err
	}

	return d.convertDynamoDBResult(result.Items, result.Count), nil
}

// executeGetItem executes a DynamoDB GetItem operation
func (d *DynamoDBAdapter) executeGetItem(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	if op.Key == nil {
		return nil, fmt.Errorf("key is required for GetItem operation")
	}

	key, err := d.convertToAttributeValueMap(op.Key)
	if err != nil {
		return nil, err
	}

	input := &dynamodb.GetItemInput{
		TableName: aws.String(op.TableName),
		Key:       key,
	}

	result, err := d.client.GetItem(ctx, input)
	if err != nil {
		return nil, err
	}

	var items []map[string]types.AttributeValue
	if result.Item != nil {
		items = append(items, result.Item)
	}

	return d.convertDynamoDBResult(items, int32(len(items))), nil
}

// executePutItem executes a DynamoDB PutItem operation
func (d *DynamoDBAdapter) executePutItem(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	if op.Item == nil {
		return nil, fmt.Errorf("item is required for PutItem operation")
	}

	item, err := d.convertToAttributeValueMap(op.Item)
	if err != nil {
		return nil, err
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(op.TableName),
		Item:      item,
	}

	_, err = d.client.PutItem(ctx, input)
	if err != nil {
		return nil, err
	}

	return &adaptertypes.QueryResult{
		Columns: d.toColumnInfo([]string{"status"}),
		Rows: []map[string]interface{}{
			{"status": "success"},
		},
		Count: 1,
	}, nil
}

// executeUpdateItem executes a DynamoDB UpdateItem operation
func (d *DynamoDBAdapter) executeUpdateItem(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	if op.Key == nil {
		return nil, fmt.Errorf("key is required for UpdateItem operation")
	}

	key, err := d.convertToAttributeValueMap(op.Key)
	if err != nil {
		return nil, err
	}

	input := &dynamodb.UpdateItemInput{
		TableName: aws.String(op.TableName),
		Key:       key,
	}

	_, err = d.client.UpdateItem(ctx, input)
	if err != nil {
		return nil, err
	}

	return &adaptertypes.QueryResult{
		Columns: d.toColumnInfo([]string{"status"}),
		Rows: []map[string]interface{}{
			{"status": "success"},
		},
		Count: 1,
	}, nil
}

// executeDeleteItem executes a DynamoDB DeleteItem operation
func (d *DynamoDBAdapter) executeDeleteItem(ctx context.Context, op *DynamoDBOperation) (*adaptertypes.QueryResult, error) {
	if op.Key == nil {
		return nil, fmt.Errorf("key is required for DeleteItem operation")
	}

	key, err := d.convertToAttributeValueMap(op.Key)
	if err != nil {
		return nil, err
	}

	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(op.TableName),
		Key:       key,
	}

	_, err = d.client.DeleteItem(ctx, input)
	if err != nil {
		return nil, err
	}

	return &adaptertypes.QueryResult{
		Columns: d.toColumnInfo([]string{"status"}),
		Rows: []map[string]interface{}{
			{"status": "success"},
		},
		Count: 1,
	}, nil
}

// executeListTables executes a DynamoDB ListTables operation
func (d *DynamoDBAdapter) executeListTables(ctx context.Context) (*adaptertypes.QueryResult, error) {
	input := &dynamodb.ListTablesInput{}

	result, err := d.client.ListTables(ctx, input)
	if err != nil {
		return nil, err
	}

	var rows []map[string]interface{}
	for _, tableName := range result.TableNames {
		rows = append(rows, map[string]interface{}{
			"table_name": tableName,
		})
	}

	return &adaptertypes.QueryResult{
		Columns: d.toColumnInfo([]string{"table_name"}),
		Rows:    rows,
		Count:   int64(len(rows)),
	}, nil
}
