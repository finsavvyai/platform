package nosql

import (
	"context"
	"fmt"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"go.mongodb.org/mongo-driver/mongo"
)

// executeInsertOperation inserts a single document. Filter/Document are
// already typed (bson.D / bson.M) by the parser — never raw strings.
func (m *MongoDBAdapter) executeInsertOperation(ctx context.Context, coll *mongo.Collection, op *MongoOperation) (*types.QueryResult, error) {
	if op.Document == nil {
		return nil, fmt.Errorf("document is required for insert operation: %w", ErrInvalidParam)
	}
	r, err := coll.InsertOne(ctx, op.Document)
	if err != nil {
		return nil, err
	}
	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "inserted_id", Type: "string"}},
		Rows:    []map[string]interface{}{{"inserted_id": r.InsertedID}},
		Count:   1,
	}, nil
}

// executeUpdateOperation runs UpdateMany with the parsed BSON filter+update.
func (m *MongoDBAdapter) executeUpdateOperation(ctx context.Context, coll *mongo.Collection, op *MongoOperation) (*types.QueryResult, error) {
	if op.Filter == nil || op.Update == nil {
		return nil, fmt.Errorf("filter and update are required for update operation: %w", ErrInvalidParam)
	}
	r, err := coll.UpdateMany(ctx, op.Filter, op.Update)
	if err != nil {
		return nil, err
	}
	return &types.QueryResult{
		Columns: []types.ColumnInfo{
			{Name: "matched_count", Type: "integer"},
			{Name: "modified_count", Type: "integer"},
		},
		Rows: []map[string]interface{}{{
			"matched_count":  r.MatchedCount,
			"modified_count": r.ModifiedCount,
		}},
		Count: 1,
	}, nil
}

// executeDeleteOperation runs DeleteMany with the parsed BSON filter.
func (m *MongoDBAdapter) executeDeleteOperation(ctx context.Context, coll *mongo.Collection, op *MongoOperation) (*types.QueryResult, error) {
	if op.Filter == nil {
		return nil, fmt.Errorf("filter is required for delete operation: %w", ErrInvalidParam)
	}
	r, err := coll.DeleteMany(ctx, op.Filter)
	if err != nil {
		return nil, err
	}
	return &types.QueryResult{
		Columns: []types.ColumnInfo{{Name: "deleted_count", Type: "integer"}},
		Rows:    []map[string]interface{}{{"deleted_count": r.DeletedCount}},
		Count:   1,
	}, nil
}
