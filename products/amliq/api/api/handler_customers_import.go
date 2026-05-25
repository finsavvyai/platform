package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

type CustomerImportHandler struct {
	deps *Dependencies
}

func NewCustomerImportHandler(deps *Dependencies) *CustomerImportHandler {
	return &CustomerImportHandler{deps: deps}
}

type ImportResult struct {
	Filename   string   `json:"filename"`
	Parsed     int      `json:"parsed"`
	Imported   int      `json:"imported"`
	Skipped    int      `json:"skipped"`
	Errors     []string `json:"errors,omitempty"`
	DurationMs int64    `json:"duration_ms"`
}

var requiredColumns = []string{"name", "type"}

// Import handles POST /ingest/customers/import with multipart CSV upload.
func (h *CustomerImportHandler) Import(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "file too large or invalid form", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	rows, err := reader.ReadAll()
	if err != nil || len(rows) < 2 {
		http.Error(w, "invalid CSV or empty", http.StatusBadRequest)
		return
	}

	headers, colIdx, missing := parseHeaders(rows[0])
	if len(missing) > 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"error":            "missing required columns",
			"missing_columns":  missing,
			"required_columns": requiredColumns,
			"found_columns":    headers,
		})
		return
	}

	result := h.processRows(rows[1:], colIdx)
	result.Filename = header.Filename
	result.DurationMs = time.Since(start).Milliseconds()
	writeJSON(w, http.StatusOK, result)
}

func parseHeaders(row []string) ([]string, map[string]int, []string) {
	headers := make([]string, len(row))
	idx := make(map[string]int, len(row))
	for i, h := range row {
		key := strings.ToLower(strings.TrimSpace(h))
		headers[i] = key
		idx[key] = i
	}
	var missing []string
	for _, req := range requiredColumns {
		if _, ok := idx[req]; !ok {
			missing = append(missing, req)
		}
	}
	return headers, idx, missing
}

func (h *CustomerImportHandler) processRows(
	rows [][]string, idx map[string]int,
) ImportResult {
	res := ImportResult{Parsed: len(rows)}
	for lineNum, row := range rows {
		if err := h.importRow(row, idx); err != nil {
			res.Skipped++
			if len(res.Errors) < 20 {
				res.Errors = append(res.Errors,
					fmt.Sprintf("line %d: %s", lineNum+2, err.Error()))
			}
			continue
		}
		res.Imported++
	}
	return res
}

func (h *CustomerImportHandler) importRow(
	row []string, idx map[string]int,
) error {
	name := getField(row, idx, "name")
	typeStr := getField(row, idx, "type")
	if name == "" || typeStr == "" {
		return fmt.Errorf("name and type required")
	}
	entType, err := domain.ParseEntityType(typeStr)
	if err != nil {
		return fmt.Errorf("invalid type: %s", typeStr)
	}
	eid, _ := domain.NewEntityID(fmt.Sprintf("cust_%d", time.Now().UnixNano()))
	nm, _ := domain.NewName(name, "", "", "")
	ent, err := domain.NewEntity(eid, entType, []domain.Name{nm})
	if err != nil {
		return err
	}
	if country := getField(row, idx, "country"); country != "" {
		ent.Nationalities = []string{country}
	}
	if h.deps != nil && h.deps.Entities != nil {
		return h.deps.Entities.Create(ent)
	}
	return nil
}

func getField(row []string, idx map[string]int, key string) string {
	i, ok := idx[key]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

