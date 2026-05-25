package repository

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/queryflux/backend/internal/shared/models"
)

// Repository interface defines common repository operations
type Repository[T any] interface {
	Create(ctx context.Context, entity *T) error
	GetByID(ctx context.Context, id string) (*T, error)
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, id string, deletedBy string) error
	List(ctx context.Context, params models.PaginationParams) (*models.PaginatedResult[T], error)
	Search(ctx context.Context, filter models.FilterParams, params models.PaginationParams) (*models.PaginatedResult[T], error)
	Count(ctx context.Context, filter models.FilterParams) (int64, error)
	Exists(ctx context.Context, id string) (bool, error)
}

// BaseRepository provides a generic repository implementation
type BaseRepository[T any] struct {
	db        *pgxpool.Pool
	tableName string
	logger    *zap.Logger
}

// NewBaseRepository creates a new base repository
func NewBaseRepository[T any](db *pgxpool.Pool, tableName string, logger *zap.Logger) *BaseRepository[T] {
	return &BaseRepository[T]{
		db:        db,
		tableName: tableName,
		logger:    logger,
	}
}

// safeTableName returns the sanitized table name using pgx.Identifier
func (r *BaseRepository[T]) safeTableName() string {
	return pgx.Identifier{r.tableName}.Sanitize()
}

// validOrderDir returns a safe ORDER direction (ASC or DESC only)
func validOrderDir(dir string) string {
	upper := strings.ToUpper(strings.TrimSpace(dir))
	if upper == "DESC" {
		return "DESC"
	}
	return "ASC"
}

// safeOrderBy validates that an order column contains only allowed chars
func safeOrderBy(col string) string {
	col = strings.TrimSpace(col)
	if col == "" {
		return "created_at"
	}
	for _, c := range col {
		if !unicode.IsLetter(c) && !unicode.IsDigit(c) && c != '_' {
			return "created_at"
		}
	}
	return col
}

// Create creates a new entity
func (r *BaseRepository[T]) Create(ctx context.Context, entity *T) error {
	// Get entity reflection
	v := reflect.ValueOf(entity).Elem()
	t := v.Type()

	// Build column names and values
	var columns []string
	var values []interface{}
	var placeholders []string

	// Common fields
	columns = append(columns, "id", "created_at", "updated_at", "version")
	values = append(values,
		v.FieldByName("ID").String(),
		v.FieldByName("CreatedAt").Interface(),
		v.FieldByName("UpdatedAt").Interface(),
		v.FieldByName("Version").Int(),
	)

	for i := 0; i < 4; i++ {
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
	}

	// Add optional fields
	if field := v.FieldByName("CreatedBy"); field.IsValid() && field.String() != "" {
		columns = append(columns, "created_by")
		values = append(values, field.String())
		placeholders = append(placeholders, fmt.Sprintf("$%d", len(values)))
	}

	if field := v.FieldByName("TenantID"); field.IsValid() && field.String() != "" {
		columns = append(columns, "tenant_id")
		values = append(values, field.String())
		placeholders = append(placeholders, fmt.Sprintf("$%d", len(values)))
	}

	// Add entity-specific fields
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		fieldValue := v.Field(i)

		// Skip base entity fields
		switch field.Name {
		case "ID", "CreatedAt", "UpdatedAt", "CreatedBy", "Version", "Metadata", "TenantID":
			continue
		}

		// Add field if it has a valid value
		if fieldValue.IsValid() && !fieldValue.IsZero() {
			// Convert field name to snake_case
			columnName := toSnakeCase(field.Name)
			columns = append(columns, columnName)
			values = append(values, fieldValue.Interface())
			placeholders = append(placeholders, fmt.Sprintf("$%d", len(values)))
		}
	}

	// Build query
	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s) RETURNING id",
		r.tableName,
		strings.Join(columns, ", "),
		strings.Join(placeholders, ", "),
	)

	// Execute query
	var id string
	err := r.db.QueryRow(ctx, query, values...).Scan(&id)
	if err != nil {
		r.logger.Error("Failed to create entity",
			zap.String("table", r.tableName),
			zap.Error(err))
		return fmt.Errorf("failed to create entity: %w", err)
	}

	// Update entity ID
	if v.FieldByName("ID").CanSet() {
		v.FieldByName("ID").SetString(id)
	}

	r.logger.Debug("Entity created",
		zap.String("table", r.tableName),
		zap.String("id", id))

	return nil
}

// GetByID retrieves an entity by ID
func (r *BaseRepository[T]) GetByID(ctx context.Context, id string) (*T, error) {
	query := fmt.Sprintf("SELECT * FROM %s WHERE id = $1 AND is_deleted = false", r.safeTableName())

	row := r.db.QueryRow(ctx, query, id)

	entity := new(T)
	err := rowScan(row, entity)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("entity not found")
		}
		return nil, fmt.Errorf("failed to scan entity: %w", err)
	}

	return entity, nil
}

// Update updates an entity
func (r *BaseRepository[T]) Update(ctx context.Context, entity *T) error {
	v := reflect.ValueOf(entity).Elem()

	// Get ID
	id := v.FieldByName("ID").String()
	if id == "" {
		return fmt.Errorf("entity ID is required")
	}

	// Update timestamp and version
	v.FieldByName("UpdatedAt").Set(reflect.ValueOf(time.Now().UTC()))
	version := v.FieldByName("Version").Int()
	v.FieldByName("Version").SetInt(version + 1)

	// Build SET clause
	var setClauses []string
	var values []interface{}
	argIndex := 1

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
	values = append(values, v.FieldByName("UpdatedAt").Interface())
	argIndex++

	setClauses = append(setClauses, fmt.Sprintf("version = $%d", argIndex))
	values = append(values, v.FieldByName("Version").Interface())
	argIndex++

	// Add other fields
	for i := 0; i < v.NumField(); i++ {
		field := v.Type().Field(i)
		fieldValue := v.Field(i)

		// Skip certain fields
		switch field.Name {
		case "ID", "CreatedAt", "CreatedBy", "Version", "TenantID":
			continue
		}

		if fieldValue.IsValid() {
			columnName := toSnakeCase(field.Name)
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", columnName, argIndex))
			values = append(values, fieldValue.Interface())
			argIndex++
		}
	}

	// Add WHERE clause
	values = append(values, id)
	values = append(values, version) // For optimistic locking

	// Build query
	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE id = $%d AND version = $%d",
		r.tableName,
		strings.Join(setClauses, ", "),
		argIndex,
		argIndex+1,
	)

	// Execute query
	result, err := r.db.Exec(ctx, query, values...)
	if err != nil {
		return fmt.Errorf("failed to update entity: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("entity not found or version mismatch")
	}

	r.logger.Debug("Entity updated",
		zap.String("table", r.tableName),
		zap.String("id", id))

	return nil
}

// Delete performs soft delete
func (r *BaseRepository[T]) Delete(ctx context.Context, id string, deletedBy string) error {
	query := fmt.Sprintf(`
		UPDATE %s
		SET is_deleted = true, deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
		WHERE id = $2 AND is_deleted = false`, r.tableName)

	result, err := r.db.Exec(ctx, query, deletedBy, id)
	if err != nil {
		return fmt.Errorf("failed to delete entity: %w", err)
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("entity not found")
	}

	r.logger.Debug("Entity deleted",
		zap.String("table", r.tableName),
		zap.String("id", id))

	return nil
}

// List retrieves a paginated list of entities
func (r *BaseRepository[T]) List(ctx context.Context, params models.PaginationParams) (*models.PaginatedResult[T], error) {
	params = params.Validate()

	// Get total count
	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE is_deleted = false", r.safeTableName())
	err := r.db.QueryRow(ctx, countQuery).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count entities: %w", err)
	}

	// Build SELECT query with validated order column and direction
	query := fmt.Sprintf(
		"SELECT * FROM %s WHERE is_deleted = false ORDER BY %s %s LIMIT $1 OFFSET $2",
		r.safeTableName(),
		safeOrderBy(params.OrderBy),
		validOrderDir(params.OrderDir),
	)

	// Execute query
	rows, err := r.db.Query(ctx, query, params.PageSize, params.GetOffset())
	if err != nil {
		return nil, fmt.Errorf("failed to query entities: %w", err)
	}
	defer rows.Close()

	// Scan results
	var entities []T
	for rows.Next() {
		entity := new(T)
		if err := rowScan(rows, entity); err != nil {
			return nil, fmt.Errorf("failed to scan entity: %w", err)
		}
		entities = append(entities, *entity)
	}

	// Build result
	pagination := models.NewPagination(params.Page, params.PageSize, total)
	result := &models.PaginatedResult[T]{
		Data:       entities,
		Pagination: pagination,
	}

	return result, nil
}

// Search searches entities with filters
func (r *BaseRepository[T]) Search(ctx context.Context, filter models.FilterParams, params models.PaginationParams) (*models.PaginatedResult[T], error) {
	params = params.Validate()

	// Build WHERE clause
	whereClause, args := filter.BuildWhereClause()
	argIndex := len(args) + 1

	// Add is_deleted condition if not already in filter
	if !strings.Contains(whereClause, "is_deleted") {
		if whereClause != "" {
			whereClause += " AND is_deleted = false"
		} else {
			whereClause = "WHERE is_deleted = false"
		}
	}

	// Get total count
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s %s", r.safeTableName(), whereClause)
	var total int64
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count entities: %w", err)
	}

	// Build SELECT query with validated order column and direction
	query := fmt.Sprintf(
		"SELECT * FROM %s %s ORDER BY %s %s LIMIT $%d OFFSET $%d",
		r.safeTableName(),
		whereClause,
		safeOrderBy(params.OrderBy),
		validOrderDir(params.OrderDir),
		argIndex,
		argIndex+1,
	)

	// Add pagination args
	args = append(args, params.PageSize, params.GetOffset())

	// Execute query
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to search entities: %w", err)
	}
	defer rows.Close()

	// Scan results
	var entities []T
	for rows.Next() {
		entity := new(T)
		if err := rowScan(rows, entity); err != nil {
			return nil, fmt.Errorf("failed to scan entity: %w", err)
		}
		entities = append(entities, *entity)
	}

	// Build result
	pagination := models.NewPagination(params.Page, params.PageSize, total)
	result := &models.PaginatedResult[T]{
		Data:       entities,
		Pagination: pagination,
	}

	return result, nil
}

// Count returns the count of entities matching filter
func (r *BaseRepository[T]) Count(ctx context.Context, filter models.FilterParams) (int64, error) {
	whereClause, args := filter.BuildWhereClause()

	// Add is_deleted condition
	if !strings.Contains(whereClause, "is_deleted") {
		if whereClause != "" {
			whereClause += " AND is_deleted = false"
		} else {
			whereClause = "WHERE is_deleted = false"
		}
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s %s", r.safeTableName(), whereClause)

	var count int64
	err := r.db.QueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count entities: %w", err)
	}

	return count, nil
}

// Exists checks if an entity exists
func (r *BaseRepository[T]) Exists(ctx context.Context, id string) (bool, error) {
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE id = $1 AND is_deleted = false)", r.safeTableName())

	var exists bool
	err := r.db.QueryRow(ctx, query, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check entity existence: %w", err)
	}

	return exists, nil
}

// BatchInsert inserts multiple entities in a single transaction
func (r *BaseRepository[T]) BatchInsert(ctx context.Context, entities []*T) error {
	if len(entities) == 0 {
		return nil
	}

	// Begin transaction
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Insert each entity
	for _, entity := range entities {
		if err := r.Create(ctx, entity); err != nil {
			return fmt.Errorf("failed to insert entity: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	r.logger.Debug("Batch insert completed",
		zap.String("table", r.tableName),
		zap.Int("count", len(entities)))

	return nil
}

// BatchUpdate updates multiple entities in a single transaction
func (r *BaseRepository[T]) BatchUpdate(ctx context.Context, entities []*T) error {
	if len(entities) == 0 {
		return nil
	}

	// Begin transaction
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update each entity
	for _, entity := range entities {
		if err := r.Update(ctx, entity); err != nil {
			return fmt.Errorf("failed to update entity: %w", err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	r.logger.Debug("Batch update completed",
		zap.String("table", r.tableName),
		zap.Int("count", len(entities)))

	return nil
}

// Helper functions

// toSnakeCase converts CamelCase to snake_case
func toSnakeCase(s string) string {
	var result []rune
	for i, r := range s {
		if i > 0 && unicode.IsUpper(r) {
			result = append(result, '_')
		}
		result = append(result, unicode.ToLower(r))
	}
	return string(result)
}

// rowScan scans a row into a struct
func rowScan(row interface{}, entity interface{}) error {
	// This is a simplified implementation
	// In production, you would use a proper ORM or reflection-based scanner
	values := reflect.ValueOf(entity).Elem()

	// For pgx
	if scanner, ok := row.(interface{ Scan(...interface{}) error }); ok {
		args := make([]interface{}, values.NumField())
		for i := 0; i < values.NumField(); i++ {
			field := values.Field(i)
			if field.CanAddr() {
				args[i] = field.Addr().Interface()
			} else {
				args[i] = new(interface{})
			}
		}
		return scanner.Scan(args...)
	}

	return fmt.Errorf("unsupported row type")
}