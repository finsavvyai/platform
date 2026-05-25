package sdln

import "time"

// ========================================
// Core Types
// ========================================

// ID represents a unique identifier
type ID string

// Timestamp represents a timestamp
type Timestamp time.Time

// Metadata represents generic metadata
type Metadata map[string]interface{}

// ========================================
// Document Chunk Types
// ========================================

// DocumentChunk represents a chunk of a document
type DocumentChunk struct {
	ID         string    `json:"id"`
	DocumentID string    `json:"document_id"`
	Index      int       `json:"index"`
	Content    string    `json:"content"`
	Metadata   Metadata  `json:"metadata,omitempty"`
	CreatedAt  Timestamp `json:"created_at"`
}

// ========================================
// Image and Media Types
// ========================================

// ImageInfo represents information about an extracted image
type ImageInfo struct {
	URL    string `json:"url"`
	Alt    string `json:"alt,omitempty"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Format string `json:"format"`
	Size   int64  `json:"size"`
}

// TableInfo represents information about an extracted table
type TableInfo struct {
	Headers []string      `json:"headers"`
	Rows    [][]string    `json:"rows"`
	Cells   [][]TableCell `json:"cells"`
}

// TableCell represents a single table cell
type TableCell struct {
	Text    string `json:"text"`
	ColSpan int    `json:"colspan"`
	RowSpan int    `json:"rowspan"`
	Style   string `json:"style,omitempty"`
}

// LinkInfo represents information about an extracted link
type LinkInfo struct {
	URL   string `json:"url"`
	Title string `json:"title,omitempty"`
	Text  string `json:"text,omitempty"`
}

// ========================================
// Quality Metrics
// ========================================

// ExtractionQuality represents extraction quality metrics
type ExtractionQuality struct {
	Accuracy       float64 `json:"accuracy"`
	Completeness   float64 `json:"completeness"`
	Confidence     float64 `json:"confidence"`
	ProcessingTime int     `json:"processing_time_ms"`
}

// ========================================
// Pagination Types
// ========================================

// ListOptions represents list query options
type ListOptions struct {
	Limit    int               `json:"limit,omitempty"`
	Offset   int               `json:"offset,omitempty"`
	Page     int               `json:"page,omitempty"`
	PageSize int               `json:"page_size,omitempty"`
	Sort     string            `json:"sort,omitempty"`
	SortBy   string            `json:"sort_by,omitempty"`
	SortDesc bool              `json:"sort_desc,omitempty"`
	Order    string            `json:"order,omitempty"`
	Filters  map[string]string `json:"filters,omitempty"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse[T any] struct {
	Data       []T  `json:"data"`
	Total      int  `json:"total"`
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	Page       int  `json:"page"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// BulkResult represents a bulk operation result
type BulkResult[T any] struct {
	SuccessCount int         `json:"success_count"`
	ErrorCount   int         `json:"error_count"`
	Results      []T         `json:"results"`
	Errors       []BulkError `json:"errors,omitempty"`
}

// BulkError represents an error in a bulk operation
type BulkError struct {
	Index   int    `json:"index"`
	ID      string `json:"id,omitempty"`
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// BulkDeleteResult represents a bulk delete result
type BulkDeleteResult struct {
	SuccessCount int         `json:"success_count"`
	ErrorCount   int         `json:"error_count"`
	Errors       []BulkError `json:"errors,omitempty"`
}

// ========================================
// Filter Types
// ========================================

// Filter represents a document filter
type Filter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, gte, lt, lte, in, nin, contains
	Value    interface{} `json:"value"`
}

// Pagination represents pagination information
type Pagination struct {
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	Total      int  `json:"total"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
	HasPrev    bool `json:"has_prev"`
}

// TimestampRange represents a range of timestamps
type TimestampRange struct {
	From *Timestamp `json:"from,omitempty"`
	To   *Timestamp `json:"to,omitempty"`
}
