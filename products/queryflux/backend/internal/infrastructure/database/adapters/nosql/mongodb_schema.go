package nosql

import (
	"context"
	"fmt"
	"reflect"
	"time"

	"github.com/queryflux/backend/internal/infrastructure/database/adapters/types"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetSchema lists collections and resolves each to a TableInfo.
func (m *MongoDBAdapter) GetSchema(ctx context.Context) (*types.SchemaInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	if m.client == nil || m.database == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to database"}
	}
	collections, err := m.database.ListCollectionNames(ctx, bson.D{})
	if err != nil {
		return nil, mongoErr("SCHEMA_QUERY_FAILED", "Failed to list collections", err)
	}
	tables := make([]types.TableInfo, 0, len(collections))
	for _, name := range collections {
		info, err := m.getTableInfoLocked(ctx, name)
		if err != nil {
			m.logger.Warnf("Failed to get collection info for %s: %v", name, err)
			info = &types.TableInfo{Name: name, Schema: m.conn.Database}
		}
		tables = append(tables, *info)
	}
	return &types.SchemaInfo{Tables: tables}, nil
}

// IntrospectSchema is the contract-mandated alias for GetSchema.
func (m *MongoDBAdapter) IntrospectSchema(ctx context.Context) (*types.SchemaInfo, error) {
	return m.GetSchema(ctx)
}

// GetTableInfo resolves a single collection. Acquires the read lock; the
// internal helper assumes the lock is already held.
func (m *MongoDBAdapter) GetTableInfo(ctx context.Context, tableName string) (*types.TableInfo, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.getTableInfoLocked(ctx, tableName)
}

func (m *MongoDBAdapter) getTableInfoLocked(ctx context.Context, tableName string) (*types.TableInfo, error) {
	if m.client == nil || m.database == nil {
		return nil, &types.AdapterError{Code: "NOT_CONNECTED", Message: "Not connected to database"}
	}
	coll := m.database.Collection(tableName)

	cursor, err := coll.Find(ctx, bson.M{}, options.Find().SetLimit(100))
	if err != nil {
		return nil, mongoErr("COLLECTION_SAMPLE_FAILED", "Failed to sample collection documents", err)
	}
	defer cursor.Close(ctx)

	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, mongoErr("DOCUMENT_SCAN_FAILED", "Failed to scan documents", err)
	}

	columns := m.inferColumnsFromDocs(docs)
	indexes := m.listCollectionIndexes(ctx, coll, tableName)
	return &types.TableInfo{
		Name:    tableName,
		Schema:  m.conn.Database,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// inferColumnsFromDocs builds a ColumnInfo set from sampled documents.
func (m *MongoDBAdapter) inferColumnsFromDocs(docs []bson.M) []types.ColumnInfo {
	fieldTypes := make(map[string]string)
	for _, d := range docs {
		for f, v := range d {
			if _, ok := fieldTypes[f]; !ok {
				fieldTypes[f] = m.inferBSONType(v)
			}
		}
	}
	cols := make([]types.ColumnInfo, 0, len(fieldTypes))
	for f, t := range fieldTypes {
		cols = append(cols, types.ColumnInfo{
			Name:         f,
			Type:         t,
			Nullable:     true,
			IsPrimaryKey: f == "_id",
		})
	}
	return cols
}

// listCollectionIndexes returns the IndexInfo for a collection; logs and
// returns nil on failure (non-fatal).
func (m *MongoDBAdapter) listCollectionIndexes(ctx context.Context, coll *mongo.Collection, tableName string) []types.IndexInfo {
	idxCursor, err := coll.Indexes().List(ctx)
	if err != nil {
		m.logger.Warnf("Failed to list indexes for collection %s: %v", tableName, err)
		return nil
	}
	defer idxCursor.Close(ctx)

	var idxDocs []bson.M
	if err := idxCursor.All(ctx, &idxDocs); err != nil {
		return nil
	}
	out := make([]types.IndexInfo, 0, len(idxDocs))
	for _, d := range idxDocs {
		name, _ := d["name"].(string)
		key, _ := d["key"].(bson.M)
		if name == "" || key == nil {
			continue
		}
		cols := make([]string, 0, len(key))
		for k := range key {
			cols = append(cols, k)
		}
		unique, _ := d["unique"].(bool)
		out = append(out, types.IndexInfo{Name: name, Columns: cols, Unique: unique})
	}
	return out
}

// convertBSONValue maps a BSON-native value into a JSON-friendly Go value.
func (m *MongoDBAdapter) convertBSONValue(value interface{}) interface{} {
	switch v := value.(type) {
	case primitive.ObjectID:
		return v.Hex()
	case primitive.DateTime:
		return time.Unix(int64(v)/1000, (int64(v)%1000)*1000000).Format(time.RFC3339)
	case primitive.Decimal128:
		return v.String()
	case primitive.Binary:
		return fmt.Sprintf("Binary(%d bytes)", len(v.Data))
	case primitive.Regex:
		return fmt.Sprintf("/%s/%s", v.Pattern, v.Options)
	case bson.M:
		out := make(map[string]interface{}, len(v))
		for k, val := range v {
			out[k] = m.convertBSONValue(val)
		}
		return out
	case bson.A:
		out := make([]interface{}, len(v))
		for i, val := range v {
			out[i] = m.convertBSONValue(val)
		}
		return out
	default:
		rv := reflect.ValueOf(value)
		if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
			out := make([]interface{}, rv.Len())
			for i := 0; i < rv.Len(); i++ {
				out[i] = m.convertBSONValue(rv.Index(i).Interface())
			}
			return out
		}
		return value
	}
}

// inferBSONType maps a BSON-native value to its canonical type name.
func (m *MongoDBAdapter) inferBSONType(value interface{}) string {
	switch value.(type) {
	case primitive.ObjectID:
		return "ObjectId"
	case string:
		return "String"
	case int, int32, int64:
		return "Int"
	case float32, float64:
		return "Double"
	case bool:
		return "Boolean"
	case primitive.DateTime, time.Time:
		return "Date"
	case bson.M, map[string]interface{}:
		return "Object"
	case bson.A, []interface{}:
		return "Array"
	case primitive.Binary:
		return "Binary"
	case primitive.Decimal128:
		return "Decimal128"
	case nil:
		return "Null"
	default:
		return "Mixed"
	}
}
