package aws

import (
	"fmt"
	"strconv"

	adaptertypes "github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
)

// convertDynamoDBResult converts DynamoDB items to QueryResult
func (d *DynamoDBAdapter) convertDynamoDBResult(items []map[string]types.AttributeValue, count int32) *adaptertypes.QueryResult {
	if len(items) == 0 {
		return &adaptertypes.QueryResult{
			Columns: []adaptertypes.ColumnInfo{},
			Rows:    []map[string]interface{}{},
			Count:   int64(count),
		}
	}

	// Extract column names from first item
	var columns []string
	columnSet := make(map[string]bool)

	for _, item := range items {
		for key := range item {
			if !columnSet[key] {
				columns = append(columns, key)
				columnSet[key] = true
			}
		}
	}

	// Convert items to rows
	var rows []map[string]interface{}
	for _, item := range items {
		row := make(map[string]interface{})
		for _, col := range columns {
			if attr, exists := item[col]; exists {
				row[col] = d.convertAttributeValue(attr)
			} else {
				row[col] = nil
			}
		}
		rows = append(rows, row)
	}

	return &adaptertypes.QueryResult{
		Columns: d.toColumnInfo(columns),
		Rows:    rows,
		Count:   int64(len(rows)),
	}
}

// convertAttributeValue converts DynamoDB AttributeValue to Go interface{}
func (d *DynamoDBAdapter) convertAttributeValue(attr types.AttributeValue) interface{} {
	switch v := attr.(type) {
	case *types.AttributeValueMemberS:
		return v.Value
	case *types.AttributeValueMemberN:
		// Try to parse as integer first, then float
		if intVal, err := strconv.ParseInt(v.Value, 10, 64); err == nil {
			return intVal
		}
		if floatVal, err := strconv.ParseFloat(v.Value, 64); err == nil {
			return floatVal
		}
		return v.Value // Return as string if parsing fails
	case *types.AttributeValueMemberB:
		return v.Value
	case *types.AttributeValueMemberBOOL:
		return v.Value
	case *types.AttributeValueMemberNULL:
		return nil
	case *types.AttributeValueMemberSS:
		return v.Value
	case *types.AttributeValueMemberNS:
		var numbers []interface{}
		for _, numStr := range v.Value {
			if intVal, err := strconv.ParseInt(numStr, 10, 64); err == nil {
				numbers = append(numbers, intVal)
			} else if floatVal, err := strconv.ParseFloat(numStr, 64); err == nil {
				numbers = append(numbers, floatVal)
			} else {
				numbers = append(numbers, numStr)
			}
		}
		return numbers
	case *types.AttributeValueMemberBS:
		return v.Value
	case *types.AttributeValueMemberM:
		result := make(map[string]interface{})
		for key, val := range v.Value {
			result[key] = d.convertAttributeValue(val)
		}
		return result
	case *types.AttributeValueMemberL:
		var result []interface{}
		for _, val := range v.Value {
			result = append(result, d.convertAttributeValue(val))
		}
		return result
	default:
		return fmt.Sprintf("Unknown AttributeValue type: %T", attr)
	}
}

// convertToAttributeValueMap converts Go map to DynamoDB AttributeValue map
func (d *DynamoDBAdapter) convertToAttributeValueMap(item map[string]interface{}) (map[string]types.AttributeValue, error) {
	result := make(map[string]types.AttributeValue)

	for key, value := range item {
		attr, err := d.convertToAttributeValue(value)
		if err != nil {
			return nil, fmt.Errorf("failed to convert attribute %s: %w", key, err)
		}
		result[key] = attr
	}

	return result, nil
}

// convertToAttributeValue converts Go interface{} to DynamoDB AttributeValue
func (d *DynamoDBAdapter) convertToAttributeValue(value interface{}) (types.AttributeValue, error) {
	if value == nil {
		return &types.AttributeValueMemberNULL{Value: true}, nil
	}

	switch v := value.(type) {
	case string:
		return &types.AttributeValueMemberS{Value: v}, nil
	case int:
		return &types.AttributeValueMemberN{Value: strconv.Itoa(v)}, nil
	case int32:
		return &types.AttributeValueMemberN{Value: strconv.FormatInt(int64(v), 10)}, nil
	case int64:
		return &types.AttributeValueMemberN{Value: strconv.FormatInt(v, 10)}, nil
	case float32:
		return &types.AttributeValueMemberN{Value: strconv.FormatFloat(float64(v), 'f', -1, 32)}, nil
	case float64:
		return &types.AttributeValueMemberN{Value: strconv.FormatFloat(v, 'f', -1, 64)}, nil
	case bool:
		return &types.AttributeValueMemberBOOL{Value: v}, nil
	case []byte:
		return &types.AttributeValueMemberB{Value: v}, nil
	case []string:
		return &types.AttributeValueMemberSS{Value: v}, nil
	case []interface{}:
		var list []types.AttributeValue
		for _, item := range v {
			attr, err := d.convertToAttributeValue(item)
			if err != nil {
				return nil, err
			}
			list = append(list, attr)
		}
		return &types.AttributeValueMemberL{Value: list}, nil
	case map[string]interface{}:
		attrMap := make(map[string]types.AttributeValue)
		for key, val := range v {
			attr, err := d.convertToAttributeValue(val)
			if err != nil {
				return nil, err
			}
			attrMap[key] = attr
		}
		return &types.AttributeValueMemberM{Value: attrMap}, nil
	default:
		return nil, fmt.Errorf("unsupported type: %T", value)
	}
}
