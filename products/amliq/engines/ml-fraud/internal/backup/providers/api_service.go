package providers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// APIServiceBackupProvider provides backup functionality for the API service
type APIServiceBackupProvider struct {
	db     *sql.DB
	logger *logrus.Logger
}

// NewAPIServiceBackupProvider creates a new API service backup provider
func NewAPIServiceBackupProvider(db *sql.DB, logger *logrus.Logger) *APIServiceBackupProvider {
	if logger == nil {
		logger = logrus.New()
	}
	return &APIServiceBackupProvider{
		db:     db,
		logger: logger,
	}
}

// GetBackupData provides backup data for the API service
func (p *APIServiceBackupProvider) GetBackupData(ctx context.Context, backupType string) (map[string]interface{}, error) {
	p.logger.WithField("backup_type", backupType).Info("Generating API service backup data")

	backupData := make(map[string]interface{})

	// Get database backup
	dbBackup, err := p.getDatabaseBackup(ctx, backupType)
	if err != nil {
		return nil, fmt.Errorf("failed to get database backup: %w", err)
	}
	backupData["database"] = dbBackup

	// Get application configuration
	config, err := p.getApplicationConfig(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get application config for backup")
	} else {
		backupData["config"] = config
	}

	// Get active sessions and important runtime data
	runtimeData, err := p.getRuntimeData(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get runtime data for backup")
	} else {
		backupData["runtime"] = runtimeData
	}

	// Get important metrics and statistics
	metrics, err := p.getMetrics(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get metrics for backup")
	} else {
		backupData["metrics"] = metrics
	}

	return backupData, nil
}

// GetBackupMetadata provides metadata for the backup
func (p *APIServiceBackupProvider) GetBackupMetadata(ctx context.Context) (map[string]string, error) {
	metadata := make(map[string]string)

	// Get database information
	dbInfo, err := p.getDatabaseInfo(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get database info")
	} else {
		for k, v := range dbInfo {
			metadata["db_"+k] = v
		}
	}

	// Get application version
	version := p.getApplicationVersion()
	metadata["app_version"] = version
	metadata["component"] = "api_service"

	// Get backup timestamp
	metadata["backup_timestamp"] = time.Now().Format(time.RFC3339)
	metadata["timezone"] = "UTC"

	// Get environment info
	metadata["environment"] = "production"
	metadata["region"] = "us-west-2"

	return metadata, nil
}

// ValidateBackupData validates the backup data
func (p *APIServiceBackupProvider) ValidateBackupData(ctx context.Context, data map[string]interface{}) error {
	if data == nil {
		return fmt.Errorf("backup data is nil")
	}

	// Validate database backup exists
	if _, ok := data["database"]; !ok {
		return fmt.Errorf("database backup is missing")
	}

	dbBackup, ok := data["database"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("database backup has invalid format")
	}

	// Validate required database backup fields
	requiredFields := []string{"schema", "data", "timestamp"}
	for _, field := range requiredFields {
		if _, ok := dbBackup[field]; !ok {
			return fmt.Errorf("database backup missing required field: %s", field)
		}
	}

	// Validate data size (basic check)
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal backup data for validation: %w", err)
	}

	if len(dataJSON) == 0 {
		return fmt.Errorf("backup data is empty")
	}

	// Log backup size for monitoring
	p.logger.WithFields(logrus.Fields{
		"data_size_bytes": len(dataJSON),
		"data_size_mb":    float64(len(dataJSON)) / 1024 / 1024,
	}).Info("Backup data validated successfully")

	return nil
}

// getDatabaseBackup creates a database backup
func (p *APIServiceBackupProvider) getDatabaseBackup(ctx context.Context, backupType string) (map[string]interface{}, error) {
	dbBackup := make(map[string]interface{})

	// Get schema information
	schema, err := p.getDatabaseSchema(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get database schema: %w", err)
	}
	dbBackup["schema"] = schema

	// Get data based on backup type
	switch backupType {
	case "full":
		data, err := p.getFullDatabaseData(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get full database data: %w", err)
		}
		dbBackup["data"] = data
	case "incremental":
		data, err := p.getIncrementalDatabaseData(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get incremental database data: %w", err)
		}
		dbBackup["data"] = data
	default:
		data, err := p.getEssentialDatabaseData(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get essential database data: %w", err)
		}
		dbBackup["data"] = data
	}

	dbBackup["timestamp"] = time.Now().Format(time.RFC3339)
	dbBackup["backup_type"] = backupType

	return dbBackup, nil
}

// getDatabaseSchema retrieves database schema information
func (p *APIServiceBackupProvider) getDatabaseSchema(ctx context.Context) (map[string]interface{}, error) {
	schema := make(map[string]interface{})

	// Get table information
	tablesQuery := `
		SELECT table_name, table_type
		FROM information_schema.tables
		WHERE table_schema = 'public'
		ORDER BY table_name
	`
	rows, err := p.db.QueryContext(ctx, tablesQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	var tables []map[string]interface{}
	for rows.Next() {
		var tableName, tableType string
		if err := rows.Scan(&tableName, &tableType); err != nil {
			return nil, fmt.Errorf("failed to scan table info: %w", err)
		}

		// Get column information for each table
		columns, err := p.getTableColumns(ctx, tableName)
		if err != nil {
			p.logger.WithError(err).WithField("table", tableName).Warn("Failed to get table columns")
			continue
		}

		tables = append(tables, map[string]interface{}{
			"name":    tableName,
			"type":    tableType,
			"columns": columns,
		})
	}

	schema["tables"] = tables
	schema["generated_at"] = time.Now().Format(time.RFC3339)

	return schema, nil
}

// getTableColumns retrieves column information for a specific table
func (p *APIServiceBackupProvider) getTableColumns(ctx context.Context, tableName string) ([]map[string]interface{}, error) {
	query := `
		SELECT column_name, data_type, is_nullable, column_default
		FROM information_schema.columns
		WHERE table_name = $1 AND table_schema = 'public'
		ORDER BY ordinal_position
	`
	rows, err := p.db.QueryContext(ctx, query, tableName)
	if err != nil {
		return nil, fmt.Errorf("failed to query columns: %w", err)
	}
	defer rows.Close()

	var columns []map[string]interface{}
	for rows.Next() {
		var columnName, dataType, isNullable sql.NullString
		var columnDefault sql.NullString

		if err := rows.Scan(&columnName, &dataType, &isNullable, &columnDefault); err != nil {
			return nil, fmt.Errorf("failed to scan column info: %w", err)
		}

		column := map[string]interface{}{
			"name":     columnName.String,
			"type":     dataType.String,
			"nullable": isNullable.String == "YES",
		}

		if columnDefault.Valid {
			column["default"] = columnDefault.String
		}

		columns = append(columns, column)
	}

	return columns, nil
}

// getFullDatabaseData retrieves all data from critical tables
func (p *APIServiceBackupProvider) getFullDatabaseData(ctx context.Context) (map[string]interface{}, error) {
	data := make(map[string]interface{})

	// Define critical tables to backup
	criticalTables := []string{
		"users", "transactions", "fraud_cases", "ml_models", "audit_logs",
	}

	for _, table := range criticalTables {
		tableData, err := p.getTableData(ctx, table, "SELECT * FROM "+table)
		if err != nil {
			p.logger.WithError(err).WithField("table", table).Warn("Failed to backup table")
			continue
		}
		data[table] = tableData
	}

	return data, nil
}

// getIncrementalDatabaseData retrieves only recent changes
func (p *APIServiceBackupProvider) getIncrementalDatabaseData(ctx context.Context) (map[string]interface{}, error) {
	data := make(map[string]interface{})

	// Get last backup timestamp (this would typically come from a backup metadata table)
	lastBackupTime := time.Now().Add(-24 * time.Hour) // Simplified for example

	// Get recent changes from critical tables
	criticalTables := []string{
		"transactions", "fraud_cases", "audit_logs",
	}

	for _, table := range criticalTables {
		// Try to find updated_at or created_at column
		var timeColumn string
		if p.hasColumn(ctx, table, "updated_at") {
			timeColumn = "updated_at"
		} else if p.hasColumn(ctx, table, "created_at") {
			timeColumn = "created_at"
		} else {
			p.logger.WithField("table", table).Warn("No timestamp column found for incremental backup")
			continue
		}

		query := fmt.Sprintf("SELECT * FROM %s WHERE %s > $1", table, timeColumn)
		tableData, err := p.getTableData(ctx, table, query, lastBackupTime)
		if err != nil {
			p.logger.WithError(err).WithField("table", table).Warn("Failed to get incremental data")
			continue
		}
		data[table] = tableData
	}

	data["incremental_since"] = lastBackupTime.Format(time.RFC3339)

	return data, nil
}

// getEssentialDatabaseData retrieves only the most critical data
func (p *APIServiceBackupProvider) getEssentialDatabaseData(ctx context.Context) (map[string]interface{}, error) {
	data := make(map[string]interface{})

	// Only backup the most critical tables and recent data
	essentialQueries := map[string]string{
		"recent_transactions": "SELECT * FROM transactions WHERE created_at > NOW() - INTERVAL '7 days'",
		"active_fraud_cases":  "SELECT * FROM fraud_cases WHERE status IN ('open', 'investigating')",
		"users_summary":       "SELECT id, email, created_at, updated_at FROM users WHERE status = 'active'",
	}

	for name, query := range essentialQueries {
		tableData, err := p.getTableData(ctx, name, query)
		if err != nil {
			p.logger.WithError(err).WithField("query_name", name).Warn("Failed to get essential data")
			continue
		}
		data[name] = tableData
	}

	return data, nil
}

// getTableData retrieves data from a table using the provided query
func (p *APIServiceBackupProvider) getTableData(ctx context.Context, name, query string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query table %s: %w", name, err)
	}
	defer rows.Close()

	// Get column names
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var data []map[string]interface{}
	for rows.Next() {
		// Create slice of interfaces to hold row values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Convert to map
		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		data = append(data, row)
	}

	return data, nil
}

// hasColumn checks if a table has a specific column
func (p *APIServiceBackupProvider) hasColumn(ctx context.Context, table, column string) bool {
	query := `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = $1 AND column_name = $2
		)
	`
	var exists bool
	err := p.db.QueryRowContext(ctx, query, table, column).Scan(&exists)
	return err == nil && exists
}

// getApplicationConfig retrieves application configuration
func (p *APIServiceBackupProvider) getApplicationConfig(ctx context.Context) (map[string]interface{}, error) {
	// This would typically read from config files, environment variables, or config service
	config := map[string]interface{}{
		"api_version":  "v1",
		"features":     []string{"fraud_detection", "ml_analysis", "real_time_monitoring"},
		"limits":       map[string]int{"max_requests_per_minute": 1000, "max_transaction_value": 100000},
		"generated_at": time.Now().Format(time.RFC3339),
	}
	return config, nil
}

// getRuntimeData retrieves important runtime data
func (p *APIServiceBackupProvider) getRuntimeData(ctx context.Context) (map[string]interface{}, error) {
	// This would collect important runtime state
	runtime := map[string]interface{}{
		"active_sessions": 150,
		"queue_sizes":     map[string]int{"high_priority": 10, "normal": 45, "low": 20},
		"cache_stats":     map[string]interface{}{"hit_rate": 0.85, "size_mb": 512},
		"generated_at":    time.Now().Format(time.RFC3339),
	}
	return runtime, nil
}

// getMetrics retrieves application metrics
func (p *APIServiceBackupProvider) getMetrics(ctx context.Context) (map[string]interface{}, error) {
	// This would collect important metrics for backup
	metrics := map[string]interface{}{
		"request_stats": map[string]interface{}{
			"requests_per_minute":  850,
			"avg_response_time_ms": 120,
			"error_rate":           0.02,
		},
		"resource_usage": map[string]interface{}{
			"cpu_percent":   65.5,
			"memory_mb":     2048,
			"disk_usage_gb": 45.2,
		},
		"business_metrics": map[string]interface{}{
			"transactions_processed": 15000,
			"fraud_cases_detected":   125,
			"ml_models_active":       5,
		},
		"generated_at": time.Now().Format(time.RFC3339),
	}
	return metrics, nil
}

// getDatabaseInfo retrieves database information
func (p *APIServiceBackupProvider) getDatabaseInfo(ctx context.Context) (map[string]string, error) {
	info := make(map[string]string)

	// Get database version
	var version string
	err := p.db.QueryRowContext(ctx, "SELECT version()").Scan(&version)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get database version")
	} else {
		info["version"] = version
	}

	// Get database size
	var size string
	err = p.db.QueryRowContext(ctx, "SELECT pg_size_pretty(pg_database_size(current_database()))").Scan(&size)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get database size")
	} else {
		info["size"] = size
	}

	info["type"] = "postgresql"
	info["backup_method"] = "logical_dump"

	return info, nil
}

// getApplicationVersion retrieves the application version
func (p *APIServiceBackupProvider) getApplicationVersion() string {
	// This would typically come from build information or config
	return "1.2.3"
}
