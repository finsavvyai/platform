package database

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// BaseRepository provides common database operations
type BaseRepository struct {
	pool   *pgxpool.Pool
	logger *logrus.Logger
}

// NewBaseRepository creates a new base repository
func NewBaseRepository(pool *pgxpool.Pool, logger *logrus.Logger) *BaseRepository {
	if logger == nil {
		logger = logrus.New()
	}
	return &BaseRepository{
		pool:   pool,
		logger: logger,
	}
}

// QueryBuilder helps build SQL queries dynamically
type QueryBuilder struct {
	query strings.Builder
	args  []interface{}
}

// NewQueryBuilder creates a new query builder
func NewQueryBuilder() *QueryBuilder {
	return &QueryBuilder{
		query: strings.Builder{},
		args:  make([]interface{}, 0),
	}
}

// Append adds text to the query
func (qb *QueryBuilder) Append(text string) *QueryBuilder {
	qb.query.WriteString(text)
	return qb
}

// Appendf adds formatted text to the query
func (qb *QueryBuilder) Appendf(format string, args ...interface{}) *QueryBuilder {
	qb.query.WriteString(fmt.Sprintf(format, args...))
	qb.args = append(qb.args, args...)
	return qb
}

// AddArg adds an argument and returns a placeholder
func (qb *QueryBuilder) AddArg(arg interface{}) string {
	qb.args = append(qb.args, arg)
	return fmt.Sprintf("$%d", len(qb.args))
}

// Query returns the built query
func (qb *QueryBuilder) Query() string {
	return qb.query.String()
}

// Args returns the arguments
func (qb *QueryBuilder) Args() []interface{} {
	return qb.args
}

// Reset resets the query builder
func (qb *QueryBuilder) Reset() *QueryBuilder {
	qb.query.Reset()
	qb.args = qb.args[:0]
	return qb
}

// buildFilterConditions builds WHERE conditions from a filter struct
func (br *BaseRepository) buildFilterConditions(filter interface{}) (string, []interface{}) {
	qb := NewQueryBuilder()
	v := reflect.ValueOf(filter)
	t := reflect.TypeOf(filter)

	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		t = t.Elem()
	}

	conditions := make([]string, 0)

	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldType := t.Field(i)

		// Skip nil values
		if field.IsNil() {
			continue
		}

		// Get the database column name from struct tag
		dbTag := fieldType.Tag.Get("db")
		if dbTag == "" || dbTag == "-" {
			continue
		}

		// Build condition based on field type
		switch field.Kind() {
		case reflect.String:
			if field.String() != "" {
				conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.String())))
			}
		case reflect.Int, reflect.Int32, reflect.Int64:
			conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
		case reflect.Bool:
			conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
		case reflect.Struct:
			// Handle UUID and time types
			if field.Type() == reflect.TypeOf(uuid.UUID{}) {
				conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
			} else if field.Type() == reflect.TypeOf(time.Time{}) {
				conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
			}
		case reflect.Ptr:
			// Handle pointer types (e.g., *time.Time, *uuid.UUID)
			if !field.IsNil() {
				conditions = append(conditions, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
			}
		}
	}

	if len(conditions) > 0 {
		return "WHERE " + strings.Join(conditions, " AND "), qb.args
	}

	return "", qb.args
}

// buildUpdateQuery builds an UPDATE query from an update struct
func (br *BaseRepository) buildUpdateQuery(tableName string, id uuid.UUID, updates interface{}) (string, []interface{}) {
	qb := NewQueryBuilder()
	v := reflect.ValueOf(updates)
	t := reflect.TypeOf(updates)

	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		t = t.Elem()
	}

	setClauses := make([]string, 0)

	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldType := t.Field(i)

		// Skip nil values
		if field.IsNil() {
			continue
		}

		// Get the database column name from struct tag
		dbTag := fieldType.Tag.Get("db")
		if dbTag == "" || dbTag == "-" {
			continue
		}

		setClauses = append(setClauses, fmt.Sprintf("%s = %s", dbTag, qb.AddArg(field.Interface())))
	}

	if len(setClauses) == 0 {
		return "", nil
	}

	// Add updated_at timestamp
	setClauses = append(setClauses, fmt.Sprintf("updated_at = %s", qb.AddArg(time.Now())))

	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = %s",
		tableName,
		strings.Join(setClauses, ", "),
		qb.AddArg(id))

	return query, qb.args
}

// executeQuery executes a query and returns rows
func (br *BaseRepository) executeQuery(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error) {
	br.logger.WithFields(logrus.Fields{
		"query": query,
		"args":  args,
	}).Debug("Executing query")

	start := time.Now()
	rows, err := br.pool.Query(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		br.logger.WithFields(logrus.Fields{
			"query":    query,
			"args":     args,
			"duration": duration,
			"error":    err.Error(),
		}).Error("Query execution failed")
		return nil, err
	}

	br.logger.WithFields(logrus.Fields{
		"query":    query,
		"args":     args,
		"duration": duration,
	}).Debug("Query executed successfully")

	return rows, nil
}

// executeQueryRow executes a query that returns a single row
func (br *BaseRepository) executeQueryRow(ctx context.Context, query string, args ...interface{}) pgx.Row {
	br.logger.WithFields(logrus.Fields{
		"query": query,
		"args":  args,
	}).Debug("Executing query row")

	start := time.Now()
	row := br.pool.QueryRow(ctx, query, args...)
	duration := time.Since(start)

	br.logger.WithFields(logrus.Fields{
		"query":    query,
		"args":     args,
		"duration": duration,
	}).Debug("Query row executed successfully")

	return row
}

// executeCommand executes a command that doesn't return rows
func (br *BaseRepository) executeCommand(ctx context.Context, query string, args ...interface{}) (int64, error) {
	br.logger.WithFields(logrus.Fields{
		"query": query,
		"args":  args,
	}).Debug("Executing command")

	start := time.Now()
	result, err := br.pool.Exec(ctx, query, args...)
	duration := time.Since(start)

	if err != nil {
		br.logger.WithFields(logrus.Fields{
			"query":    query,
			"args":     args,
			"duration": duration,
			"error":    err.Error(),
		}).Error("Command execution failed")
		return 0, err
	}

	rowsAffected := result.RowsAffected()
	br.logger.WithFields(logrus.Fields{
		"query":         query,
		"args":          args,
		"duration":      duration,
		"rows_affected": rowsAffected,
	}).Debug("Command executed successfully")

	return rowsAffected, nil
}

// scanRow scans a row into a struct using reflection
func (br *BaseRepository) scanRow(rows pgx.Rows, dest interface{}) error {
	destValue := reflect.ValueOf(dest)
	if destValue.Kind() != reflect.Ptr || destValue.IsNil() {
		return fmt.Errorf("dest must be a non-nil pointer")
	}

	destValue = destValue.Elem()
	if destValue.Kind() != reflect.Struct {
		return fmt.Errorf("dest must point to a struct")
	}

	// Get the number of columns
	columns := rows.FieldDescriptions()
	if len(columns) == 0 {
		return fmt.Errorf("no columns in result set")
	}

	// Create a slice of pointers to struct fields
	fields := make([]interface{}, len(columns))
	for i, col := range columns {
		fieldName := string(col.Name)
		field := destValue.FieldByName(fieldName)

		if !field.IsValid() || !field.CanSet() {
			// Try to find field by JSON tag
			field = br.findFieldByTag(destValue.Type(), fieldName)
		}

		if field.IsValid() && field.CanSet() {
			if field.Kind() == reflect.Ptr {
				if field.IsNil() {
					// Initialize pointer field
					field.Set(reflect.New(field.Type().Elem()))
				}
				fields[i] = field.Interface()
			} else {
				fields[i] = field.Addr().Interface()
			}
		} else {
			// Create a placeholder for unmapped columns
			var placeholder interface{}
			fields[i] = &placeholder
		}
	}

	return rows.Scan(fields...)
}

// findFieldByTag finds a struct field by its tag
func (br *BaseRepository) findFieldByTag(t reflect.Type, tagName string) reflect.Value {
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		if field.Tag.Get("db") == tagName {
			return reflect.New(t).Elem().Field(i)
		}
	}
	return reflect.Value{}
}

// count executes a COUNT query
func (br *BaseRepository) count(ctx context.Context, tableName string, conditions string, args ...interface{}) (int, error) {
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s %s", tableName, conditions)

	var count int
	err := br.executeQueryRow(ctx, query, args...).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count records in %s: %w", tableName, err)
	}

	return count, nil
}

// exists checks if a record exists
func (br *BaseRepository) exists(ctx context.Context, tableName string, conditions string, args ...interface{}) (bool, error) {
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s %s)", tableName, conditions)

	var exists bool
	err := br.executeQueryRow(ctx, query, args...).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check existence in %s: %w", tableName, err)
	}

	return exists, nil
}

// delete removes a record by ID
func (br *BaseRepository) delete(ctx context.Context, tableName string, id uuid.UUID) error {
	query := fmt.Sprintf("DELETE FROM %s WHERE id = $1", tableName)

	result, err := br.executeCommand(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete record from %s: %w", tableName, err)
	}

	if result == 0 {
		return fmt.Errorf("no record found in %s with id %s", tableName, id)
	}

	return nil
}

// TransactionManager handles database transactions
type TransactionManager struct {
	pool   *pgxpool.Pool
	logger *logrus.Logger
}

// NewTransactionManager creates a new transaction manager
func NewTransactionManager(pool *pgxpool.Pool, logger *logrus.Logger) *TransactionManager {
	if logger == nil {
		logger = logrus.New()
	}
	return &TransactionManager{
		pool:   pool,
		logger: logger,
	}
}

// Begin starts a new transaction
func (tm *TransactionManager) Begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := tm.pool.Begin(ctx)
	if err != nil {
		tm.logger.WithError(err).Error("Failed to begin transaction")
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	tm.logger.Debug("Transaction started")
	return tx, nil
}

// Commit commits a transaction
func (tm *TransactionManager) Commit(ctx context.Context, tx pgx.Tx) error {
	if err := tx.Commit(ctx); err != nil {
		tm.logger.WithError(err).Error("Failed to commit transaction")
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	tm.logger.Debug("Transaction committed")
	return nil
}

// Rollback rolls back a transaction
func (tm *TransactionManager) Rollback(ctx context.Context, tx pgx.Tx) error {
	if err := tx.Rollback(ctx); err != nil {
		tm.logger.WithError(err).Error("Failed to rollback transaction")
		return fmt.Errorf("failed to rollback transaction: %w", err)
	}

	tm.logger.Debug("Transaction rolled back")
	return nil
}

// WithTransaction executes a function within a transaction
func (tm *TransactionManager) WithTransaction(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := tm.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tm.Rollback(ctx, tx)
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		if rbErr := tm.Rollback(ctx, tx); rbErr != nil {
			tm.logger.WithFields(logrus.Fields{
				"error":          err,
				"rollback_error": rbErr,
			}).Error("Failed to rollback transaction after error")
		}
		return err
	}

	return tm.Commit(ctx, tx)
}
