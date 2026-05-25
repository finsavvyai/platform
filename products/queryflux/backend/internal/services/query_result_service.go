//go:build experimental_services

package services

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/domain/repositories"
	"github.com/queryflux/backend/internal/infrastructure/cache"
	"github.com/xuri/excelize/v2"
	"go.uber.org/zap"
)

// QueryResultService handles query result processing and formatting
type QueryResultService struct {
	queryRepo repositories.QueryRepository
	cache     *cache.RedisCache
	logger    *zap.Logger
}

// NewQueryResultService creates a new query result service
func NewQueryResultService(
	queryRepo repositories.QueryRepository,
	cache *cache.RedisCache,
	logger *zap.Logger,
) *QueryResultService {
	return &QueryResultService{
		queryRepo: queryRepo,
		cache:     cache,
		logger:    logger,
	}
}

// ProcessResult converts raw query result into formatted output
func (s *QueryResultService) ProcessResult(ctx context.Context, result *entities.QueryResult, format string) (interface{}, error) {
	switch format {
	case "json":
		return s.toJSON(result)
	case "csv":
		return s.toCSV(result)
	case "excel":
		return s.toExcel(result)
	case "html":
		return s.toHTML(result)
	default:
		return s.toJSON(result)
	}
}

// PaginateResult paginates a query result
func (s *QueryResultService) PaginateResult(result *entities.QueryResult, page, pageSize int) (*entities.PaginatedResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 10000 {
		pageSize = 100
	}

	totalRows := len(result.Rows)
	totalPages := (totalRows + pageSize - 1) / pageSize

	startRow := (page - 1) * pageSize
	endRow := startRow + pageSize

	if startRow >= totalRows {
		return &entities.PaginatedResult{
			Page:       page,
			PageSize:   pageSize,
			TotalPages: totalPages,
			TotalRows:  totalRows,
			Rows:       [][]interface{}{},
			HasMore:    false,
		}, nil
	}

	if endRow > totalRows {
		endRow = totalRows
	}

	paginatedRows := result.Rows[startRow:endRow]

	return &entities.PaginatedResult{
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
		TotalRows:  totalRows,
		Columns:    result.Columns,
		Rows:       paginatedRows,
		HasMore:    page < totalPages,
	}, nil
}

// StreamResult streams query results in chunks
func (s *QueryResultService) StreamResult(ctx context.Context, result *entities.QueryResult, chunkSize int, callback func(*entities.ResultChunk) error) error {
	if chunkSize <= 0 {
		chunkSize = 100
	}

	totalRows := len(result.Rows)
	totalChunks := (totalRows + chunkSize - 1) / chunkSize

	for i := 0; i < totalChunks; i++ {
		startRow := i * chunkSize
		endRow := startRow + chunkSize

		if endRow > totalRows {
			endRow = totalRows
		}

		chunk := &entities.ResultChunk{
			ChunkNumber: i + 1,
			TotalChunks: totalChunks,
			Columns:     result.Columns,
			Rows:        result.Rows[startRow:endRow],
			HasMore:     i < totalChunks-1,
		}

		if err := callback(chunk); err != nil {
			return fmt.Errorf("callback error: %w", err)
		}

		// Check context for cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}

	return nil
}

// ExportResult exports a query result to various formats
func (s *QueryResultService) ExportResult(ctx context.Context, result *entities.QueryResult, format string, filename string) ([]byte, string, error) {
	switch format {
	case "json":
		data, err := s.exportToJSON(result)
		return data, filename + ".json", err

	case "csv":
		data, err := s.exportToCSV(result)
		return data, filename + ".csv", err

	case "excel":
		data, err := s.exportToExcel(result)
		return data, filename + ".xlsx", err

	case "html":
		data, err := s.exportToHTML(result)
		return data, filename + ".html", err

	default:
		return nil, "", fmt.Errorf("unsupported export format: %s", format)
	}
}

// CacheResult caches a query result for repeated access
func (s *QueryResultService) CacheResult(ctx context.Context, queryID string, result *entities.QueryResult, ttl time.Duration) error {
	if s.cache == nil {
		return nil // Cache not configured
	}

	// Serialize result
	data, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to serialize result: %w", err)
	}

	// Store in cache
	key := fmt.Sprintf("query_result:%s", queryID)
	if err := s.cache.Set(ctx, key, data, ttl); err != nil {
		return fmt.Errorf("failed to cache result: %w", err)
	}

	s.logger.Info("Query result cached",
		zap.String("query_id", queryID),
		zap.Duration("ttl", ttl),
	)

	return nil
}

// GetCachedResult retrieves a cached query result
func (s *QueryResultService) GetCachedResult(ctx context.Context, queryID string) (*entities.QueryResult, error) {
	if s.cache == nil {
		return nil, fmt.Errorf("cache not configured")
	}

	key := fmt.Sprintf("query_result:%s", queryID)
	data, err := s.cache.Get(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("cache miss: %w", err)
	}

	var result entities.QueryResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to deserialize result: %w", err)
	}

	return &result, nil
}

// ProcessBinaryData handles binary data (BLOBs, files) in query results
func (s *QueryResultService) ProcessBinaryData(result *entities.QueryResult) (*entities.QueryResult, error) {
	processed := &entities.QueryResult{
		Columns:       result.Columns,
		Rows:          make([][]interface{}, len(result.Rows)),
		RowsAffected:  result.RowsAffected,
		ExecutionTime: result.ExecutionTime,
		Query:         result.Query,
		Parameters:    result.Parameters,
	}

	for i, row := range result.Rows {
		processedRow := make([]interface{}, len(row))
		for j, value := range row {
			// Handle binary data
			if data, ok := value.([]byte); ok {
				// Convert to base64 for JSON serialization
				processedRow[j] = fmt.Sprintf("BLOB:%d bytes", len(data))
			} else if data, ok := value.(*[]byte); ok && data != nil {
				processedRow[j] = fmt.Sprintf("BLOB:%d bytes", len(*data))
			} else {
				processedRow[j] = value
			}
		}
		processed.Rows[i] = processedRow
	}

	return processed, nil
}

// ProcessMultipleResultSets handles stored procedures returning multiple result sets
func (s *QueryResultService) ProcessMultipleResultSets(resultSets []*entities.QueryResult) ([]*entities.ProcessedResultSet, error) {
	processed := make([]*entities.ProcessedResultSet, len(resultSets))

	for i, result := range resultSets {
		processedResult := &entities.ProcessedResultSet{
			ResultSetIndex: i,
			Columns:        result.Columns,
			Rows:           result.Rows,
			RowsAffected:   result.RowsAffected,
			ExecutionTime:  result.ExecutionTime,
		}
		processed[i] = processedResult
	}

	return processed, nil
}

// OptimizeResultMemory optimizes memory usage for large result sets
func (s *QueryResultService) OptimizeResultMemory(result *entities.QueryResult) (*entities.QueryResult, error) {
	// For very large result sets, process in chunks
	if len(result.Rows) > 100000 {
		return s.processLargeResult(result)
	}

	// For medium result sets, optimize column types
	return s.optimizeColumnTypes(result)
}

// Helper functions

func (s *QueryResultService) toJSON(result *entities.QueryResult) (interface{}, error) {
	return map[string]interface{}{
		"columns":           result.Columns,
		"rows":              result.Rows,
		"rows_affected":     result.RowsAffected,
		"execution_time_ms": result.ExecutionTime,
		"query":             result.Query,
	}, nil
}

func (s *QueryResultService) toCSV(result *entities.QueryResult) (interface{}, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	if err := writer.Write(result.Columns); err != nil {
		return nil, fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Write rows
	for _, row := range result.Rows {
		record := make([]string, len(row))
		for i, value := range row {
			record[i] = fmt.Sprintf("%v", value)
		}
		if err := writer.Write(record); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()

	return map[string]interface{}{
		"format":  "csv",
		"data":    buf.String(),
		"rows":    len(result.Rows),
		"columns": len(result.Columns),
	}, nil
}

func (s *QueryResultService) toExcel(result *entities.QueryResult) (interface{}, error) {
	f := excelize.NewFile()
	defer f.Close()

	// Create sheet
	sheetName := "Query Results"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to create sheet: %w", err)
	}

	// Write headers
	for i, col := range result.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, col)
	}

	// Write rows
	for rowIdx, row := range result.Rows {
		for colIdx, value := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheetName, cell, fmt.Sprintf("%v", value))
		}
	}

	// Auto-format columns
	endCell, _ := excelize.CoordinatesToCellName(len(result.Columns)+1, len(result.Rows)+1)
	f.SetColWidth(sheetName, "A", endCell[:1], 15)

	// Save to buffer
	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, fmt.Errorf("failed to write Excel buffer: %w", err)
	}

	return map[string]interface{}{
		"format":   "excel",
		"data":     buf.Bytes(),
		"filename": fmt.Sprintf("query_result_%d.xlsx", time.Now().Unix()),
		"rows":     len(result.Rows),
		"columns":  len(result.Columns),
	}, nil
}

func (s *QueryResultService) toHTML(result *entities.QueryResult) (interface{}, error) {
	html := "<html><head><title>Query Results</title>"
	html += "<style>"
	html += "table { border-collapse: collapse; width: 100%; }"
	html += "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }"
	html += "th { background-color: #4CAF50; color: white; }"
	html += "tr:nth-child(even) { background-color: #f2f2f2; }"
	html += "</style></head><body>"
	html += "<h2>Query Results</h2>"
	html += fmt.Sprintf("<p><strong>Query:</strong> %s</p>", result.Query)
	html += fmt.Sprintf("<p><strong>Rows Affected:</strong> %d</p>", result.RowsAffected)
	html += fmt.Sprintf("<p><strong>Execution Time:</strong> %dms</p>", result.ExecutionTime)
	html += "<table>"

	// Header
	html += "<tr>"
	for _, col := range result.Columns {
		html += fmt.Sprintf("<th>%s</th>", col)
	}
	html += "</tr>"

	// Rows
	for _, row := range result.Rows {
		html += "<tr>"
		for _, value := range row {
			html += fmt.Sprintf("<td>%v</td>", value)
		}
		html += "</tr>"
	}

	html += "</table>"
	html += fmt.Sprintf("<p><strong>Total Rows:</strong> %d</p>", len(result.Rows))
	html += "</body></html>"

	return map[string]interface{}{
		"format":  "html",
		"data":    html,
		"rows":    len(result.Rows),
		"columns": len(result.Columns),
	}, nil
}

func (s *QueryResultService) exportToJSON(result *entities.QueryResult) ([]byte, error) {
	export := map[string]interface{}{
		"query":          result.Query,
		"columns":        result.Columns,
		"rows":           result.Rows,
		"rows_affected":  result.RowsAffected,
		"execution_time": result.ExecutionTime,
		"exported_at":    time.Now().Format(time.RFC3339),
	}

	return json.MarshalIndent(export, "", "  ")
}

func (s *QueryResultService) exportToCSV(result *entities.QueryResult) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	writer.Write(result.Columns)

	// Write rows
	for _, row := range result.Rows {
		record := make([]string, len(row))
		for i, value := range row {
			record[i] = fmt.Sprintf("%v", value)
		}
		writer.Write(record)
	}

	writer.Flush()
	return buf.Bytes(), nil
}

func (s *QueryResultService) exportToExcel(result *entities.QueryResult) ([]byte, error) {
	f := excelize.NewFile()

	// Create sheet
	sheetName := "Query Results"
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, err
	}

	// Write headers
	for i, col := range result.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, col)
	}

	// Write rows
	for rowIdx, row := range result.Rows {
		for colIdx, value := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheetName, cell, fmt.Sprintf("%v", value))
		}
	}

	// Auto-format columns
	endCell, _ := excelize.CoordinatesToCellName(len(result.Columns)+1, len(result.Rows)+1)
	f.SetColWidth(sheetName, "A", endCell[:1], 15)

	return f.WriteToBuffer()
}

func (s *QueryResultService) exportToHTML(result *entities.QueryResult) ([]byte, error) {
	html, err := s.toHTML(result)
	if err != nil {
		return nil, err
	}

	data := html.(map[string]interface{})
	return []byte(data["data"].(string)), nil
}

func (s *QueryResultService) processLargeResult(result *entities.QueryResult) (*entities.QueryResult, error) {
	// Process in chunks to reduce memory pressure
	chunkSize := 10000
	chunks := make([][][]interface{}, 0, (len(result.Rows)+chunkSize-1)/chunkSize)

	for i := 0; i < len(result.Rows); i += chunkSize {
		end := i + chunkSize
		if end > len(result.Rows) {
			end = len(result.Rows)
		}
		chunks = append(chunks, result.Rows[i:end])
	}

	// Store chunks instead of full result
	return &entities.QueryResult{
		Columns:       result.Columns,
		Rows:          chunks[0], // Return first chunk
		RowsAffected:  result.RowsAffected,
		ExecutionTime: result.ExecutionTime,
		Query:         result.Query,
	}, nil
}

func (s *QueryResultService) optimizeColumnTypes(result *entities.QueryResult) (*entities.QueryResult, error) {
	// Optimize column types to reduce memory
	for _, row := range result.Rows {
		for i, value := range row {
			// Convert large strings to small types if possible
			if str, ok := value.(string); ok {
				// Try to convert to number
				if num, err := strconv.ParseInt(str, 10, 64); err == nil {
					row[i] = num
				} else if fl, err := strconv.ParseFloat(str, 64); err == nil {
					row[i] = fl
				} else if bl, err := strconv.ParseBool(str); err == nil {
					row[i] = bl
				}
			}
		}
	}

	return result, nil
}
