package nosql

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// MongoOperation is the structured form of a parsed MongoDB query.
// Operations are typed (bson.D / bson.M) — callers MUST NOT pass raw
// shell-strings into the driver; the parser converts to BSON first.
type MongoOperation struct {
	Type       string      `json:"type"` // find | aggregate | insert | update | delete
	Collection string      `json:"collection"`
	Filter     interface{} `json:"filter,omitempty"`
	Pipeline   interface{} `json:"pipeline,omitempty"`
	Document   interface{} `json:"document,omitempty"`
	Update     interface{} `json:"update,omitempty"`
	Options    interface{} `json:"options,omitempty"`
}

// ExecuteQuery parses a query string (JSON operation envelope or shell-like
// "db.coll.find(...)") into a typed MongoOperation and dispatches it.
func (m *MongoDBAdapter) ExecuteQuery(ctx context.Context, query string, params ...interface{}) (*types.QueryResult, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	if m.client == nil || m.database == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to database"}
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, &types.AdapterError{Code: "EMPTY_QUERY", Message: "Query cannot be empty"}
	}

	op, err := m.parseMongoOperation(query)
	if err != nil {
		return nil, mongoErr("QUERY_PARSE_FAILED", "Failed to parse MongoDB operation", err)
	}
	res, err := m.executeMongoOperation(ctx, op)
	if err != nil {
		return nil, mongoErr("QUERY_EXECUTION_FAILED", "Failed to execute MongoDB operation", err)
	}
	return res, nil
}

// parseMongoOperation turns the opaque query string into a structured op.
func (m *MongoDBAdapter) parseMongoOperation(query string) (*MongoOperation, error) {
	query = strings.TrimSpace(query)

	var op MongoOperation
	if err := json.Unmarshal([]byte(query), &op); err == nil && op.Type != "" {
		return &op, nil
	}

	if strings.HasPrefix(query, "db.") {
		return m.parseShellSyntax(query)
	}

	// Fallback: bare extended-JSON filter → find on first collection.
	collections, err := m.database.ListCollectionNames(context.Background(), bson.D{})
	if err != nil || len(collections) == 0 {
		return nil, fmt.Errorf("no collections found and cannot parse query")
	}
	var filter bson.M
	if err := bson.UnmarshalExtJSON([]byte(query), true, &filter); err == nil {
		return &MongoOperation{Type: "find", Collection: collections[0], Filter: filter}, nil
	}
	return nil, fmt.Errorf("unable to parse MongoDB query")
}

// parseShellSyntax handles "db.<collection>.<op>(...)" shorthand.
func (m *MongoDBAdapter) parseShellSyntax(query string) (*MongoOperation, error) {
	query = strings.TrimPrefix(query, "db.")
	parts := strings.SplitN(query, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid MongoDB shell syntax")
	}
	collection, op := parts[0], parts[1]
	switch {
	case strings.HasPrefix(op, "find("):
		return &MongoOperation{Type: "find", Collection: collection, Filter: bson.M{}}, nil
	case strings.HasPrefix(op, "aggregate("):
		return &MongoOperation{Type: "aggregate", Collection: collection, Pipeline: []bson.M{}}, nil
	}
	return nil, fmt.Errorf("unsupported MongoDB operation: %s", op)
}

// executeMongoOperation dispatches by op type.
func (m *MongoDBAdapter) executeMongoOperation(ctx context.Context, op *MongoOperation) (*types.QueryResult, error) {
	coll := m.database.Collection(op.Collection)
	switch op.Type {
	case "find":
		return m.executeFindOperation(ctx, coll, op)
	case "aggregate":
		return m.executeAggregateOperation(ctx, coll, op)
	case "insert":
		return m.executeInsertOperation(ctx, coll, op)
	case "update":
		return m.executeUpdateOperation(ctx, coll, op)
	case "delete":
		return m.executeDeleteOperation(ctx, coll, op)
	default:
		return nil, fmt.Errorf("unsupported operation type: %s", op.Type)
	}
}

func (m *MongoDBAdapter) executeFindOperation(ctx context.Context, coll *mongo.Collection, op *MongoOperation) (*types.QueryResult, error) {
	filter := op.Filter
	if filter == nil {
		filter = bson.M{}
	}
	cursor, err := coll.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return m.convertDocumentsToResult(docs), nil
}

func (m *MongoDBAdapter) executeAggregateOperation(ctx context.Context, coll *mongo.Collection, op *MongoOperation) (*types.QueryResult, error) {
	pipeline := op.Pipeline
	if pipeline == nil {
		pipeline = []bson.M{}
	}
	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	return m.convertDocumentsToResult(docs), nil
}

// convertDocumentsToResult turns a slice of BSON docs into a QueryResult with
// stable column order (first-seen wins, matching SQL adapter semantics).
func (m *MongoDBAdapter) convertDocumentsToResult(docs []bson.M) *types.QueryResult {
	var rows []map[string]interface{}
	var columns []types.ColumnInfo
	seen := make(map[string]bool)
	for _, d := range docs {
		row := make(map[string]interface{}, len(d))
		for k, v := range d {
			row[k] = m.convertBSONValue(v)
			if !seen[k] {
				columns = append(columns, types.ColumnInfo{Name: k, Type: m.inferBSONType(v)})
				seen[k] = true
			}
		}
		rows = append(rows, row)
	}
	return &types.QueryResult{Columns: columns, Rows: rows, Count: int64(len(rows))}
}
