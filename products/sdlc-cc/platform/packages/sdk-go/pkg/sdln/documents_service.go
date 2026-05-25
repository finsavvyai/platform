package sdln

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DocumentService handles document-related operations
type DocumentService struct {
	*BaseService
}

// NewDocumentService creates a new document service
func NewDocumentService(client *Client) *DocumentService {
	return &DocumentService{
		BaseService: NewBaseService(client, "documents", "api/v1/documents"),
	}
}

// UploadRequest represents a document upload request
type UploadRequest struct {
	File          *os.File         `json:"-"`
	Filename      string           `json:"filename"`
	ContentType   string           `json:"content_type"`
	Size          int64            `json:"size"`
	TenantID      string           `json:"tenant_id"`
	Metadata      DocumentMetadata `json:"metadata"`
	Tags          []string         `json:"tags,omitempty"`
	IsPublic      bool             `json:"is_public,omitempty"`
	IsEncrypted   bool             `json:"is_encrypted,omitempty"`
	RetentionDays *int             `json:"retention_days,omitempty"`
}

// DocumentMetadata represents document metadata
type DocumentMetadata struct {
	Title        string            `json:"title,omitempty"`
	Description  string            `json:"description,omitempty"`
	Author       string            `json:"author,omitempty"`
	Language     string            `json:"language,omitempty"`
	Category     string            `json:"category,omitempty"`
	CustomFields map[string]string `json:"custom_fields,omitempty"`
}

// Document represents a document
type Document struct {
	ID           string           `json:"id"`
	TenantID     string           `json:"tenant_id"`
	Filename     string           `json:"filename"`
	OriginalName string           `json:"original_name"`
	ContentType  string           `json:"content_type"`
	Size         int64            `json:"size"`
	Hash         string           `json:"hash"`
	Metadata     DocumentMetadata `json:"metadata"`
	Tags         []string         `json:"tags"`
	IsPublic     bool             `json:"is_public"`
	IsEncrypted  bool             `json:"is_encrypted"`
	Status       string           `json:"status"` // uploading, processing, completed, error
	ProcessedAt  *Timestamp       `json:"processed_at,omitempty"`
	ExpiresAt    *Timestamp       `json:"expires_at,omitempty"`
	CreatedAt    Timestamp        `json:"created_at"`
	UpdatedAt    Timestamp        `json:"updated_at"`
}

// DocumentContent represents extracted document content
type DocumentContent struct {
	DocumentID string            `json:"document_id"`
	Text       string            `json:"text"`
	Pages      []Page            `json:"pages,omitempty"`
	Metadata   ExtractedMetadata `json:"metadata"`
	Chunks     []Chunk           `json:"chunks,omitempty"`
}

// Page represents a document page
type Page struct {
	Number   int    `json:"number"`
	Text     string `json:"text"`
	ImageURL string `json:"image_url,omitempty"`
}

// ExtractedMetadata represents extracted metadata
type ExtractedMetadata struct {
	Title        string     `json:"title,omitempty"`
	Authors      []string   `json:"authors,omitempty"`
	CreatedDate  *Timestamp `json:"created_date,omitempty"`
	ModifiedDate *Timestamp `json:"modified_date,omitempty"`
	Language     string     `json:"language,omitempty"`
	PageCount    int        `json:"page_count,omitempty"`
	WordCount    int        `json:"word_count,omitempty"`
}

// Chunk represents a text chunk
type Chunk struct {
	ID       string `json:"id"`
	Index    int    `json:"index"`
	Text     string `json:"text"`
	StartPos int    `json:"start_pos"`
	EndPos   int    `json:"end_pos"`
	PageNum  *int   `json:"page_num,omitempty"`
}

// Upload uploads a document
func (s *DocumentService) Upload(ctx context.Context, req *UploadRequest) (*Document, error) {
	// Prepare multipart form
	var pipeReader, pipeWriter = io.Pipe()
	writer := multipart.NewWriter(pipeWriter)

	// Write form data in a goroutine
	go func() {
		defer pipeWriter.Close()
		defer writer.Close()

		// Write file
		part, err := writer.CreateFormFile("file", req.Filename)
		if err != nil {
			return
		}
		io.Copy(part, req.File)

		// Write metadata
		metadataBytes, _ := json.Marshal(req.Metadata)
		writer.WriteField("metadata", string(metadataBytes))

		// Write other fields
		writer.WriteField("tenant_id", req.TenantID)
		writer.WriteField("content_type", req.ContentType)
		writer.WriteField("size", fmt.Sprintf("%d", req.Size))

		if req.IsPublic {
			writer.WriteField("is_public", "true")
		}
		if req.IsEncrypted {
			writer.WriteField("is_encrypted", "true")
		}
		if req.RetentionDays != nil {
			writer.WriteField("retention_days", fmt.Sprintf("%d", *req.RetentionDays))
		}

		// Write tags
		for _, tag := range req.Tags {
			writer.WriteField("tags", tag)
		}
	}()

	// Create HTTP request
	fullURL := s.serviceURL + "/upload"
	httpReq, err := http.NewRequestWithContext(ctx, "POST", fullURL, pipeReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", writer.FormDataContentType())
	httpReq.Header.Set("Accept", "application/json")

	// Add authentication
	if s.client.auth != nil {
		wrappedReq := newHTTPRequest(httpReq)
		if err := s.client.auth.Authenticate(ctx, *wrappedReq); err != nil {
			return nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	// Execute request
	resp, err := s.client.do(ctx, httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.Unmarshal(body, &apiErr); err != nil {
			return nil, &APIError{
				Type:       getErrorTypeFromStatus(resp.StatusCode),
				Message:    string(body),
				StatusCode: resp.StatusCode,
				Timestamp:  time.Now().UTC(),
			}
		}
		apiErr.StatusCode = resp.StatusCode
		return nil, &apiErr
	}

	var document Document
	if err := json.Unmarshal(body, &document); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &document, nil
}

// UploadFromPath uploads a document from a file path
func (s *DocumentService) UploadFromPath(ctx context.Context, filePath string, tenantID string, metadata DocumentMetadata) (*Document, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	req := &UploadRequest{
		File:        file,
		Filename:    filepath.Base(filePath),
		ContentType: getContentType(filePath),
		Size:        stat.Size(),
		TenantID:    tenantID,
		Metadata:    metadata,
	}

	return s.Upload(ctx, req)
}

// Get retrieves a document by ID
func (s *DocumentService) Get(ctx context.Context, documentID string) (*Document, error) {
	var document Document
	err := s.doGet(ctx, fmt.Sprintf("/%s", documentID), &document)
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}
	return &document, nil
}

// List retrieves a list of documents
func (s *DocumentService) List(ctx context.Context, opts *ListOptions) (*PaginatedResponse[Document], error) {
	path := ""
	if opts != nil {
		path = s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var response PaginatedResponse[Document]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	return &response, nil
}

// Update updates a document
func (s *DocumentService) Update(ctx context.Context, documentID string, metadata *DocumentMetadata, tags []string) (*Document, error) {
	req := map[string]interface{}{
		"metadata": metadata,
		"tags":     tags,
	}

	var document Document
	err := s.doPatch(ctx, fmt.Sprintf("/%s", documentID), req, &document)
	if err != nil {
		return nil, fmt.Errorf("failed to update document: %w", err)
	}
	return &document, nil
}

// Delete deletes a document
func (s *DocumentService) Delete(ctx context.Context, documentID string) error {
	err := s.doDelete(ctx, fmt.Sprintf("/%s", documentID))
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	return nil
}

// GetContent retrieves extracted document content
func (s *DocumentService) GetContent(ctx context.Context, documentID string) (*DocumentContent, error) {
	var content DocumentContent
	err := s.doGet(ctx, fmt.Sprintf("/%s/content", documentID), &content)
	if err != nil {
		return nil, fmt.Errorf("failed to get document content: %w", err)
	}
	return &content, nil
}

// Download downloads a document
func (s *DocumentService) Download(ctx context.Context, documentID string) (io.ReadCloser, *DocumentInfo, error) {
	fullURL := s.serviceURL + fmt.Sprintf("/%s/download", documentID)

	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication
	if s.client.auth != nil {
		wrappedReq2 := newHTTPRequest(req)
		if err := s.client.auth.Authenticate(ctx, *wrappedReq2); err != nil {
			return nil, nil, fmt.Errorf("authentication failed: %w", err)
		}
	}

	resp, err := s.client.do(ctx, req)
	if err != nil {
		return nil, nil, err
	}

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, nil, &APIError{
			Type:       getErrorTypeFromStatus(resp.StatusCode),
			Message:    string(body),
			StatusCode: resp.StatusCode,
			Timestamp:  time.Now().UTC(),
		}
	}

	info := &DocumentInfo{
		Filename:    resp.Header.Get("Content-Filename"),
		ContentType: resp.Header.Get("Content-Type"),
		Size:        resp.ContentLength,
	}

	return resp.Body, info, nil
}

// Search searches for documents
func (s *DocumentService) Search(ctx context.Context, query string, opts *SearchOptions) (*SearchResponse[Document], error) {
	path := "/search" + s.buildQuery(map[string]interface{}{
		"q":         query,
		"page":      opts.Page,
		"page_size": opts.PageSize,
		"sort_by":   opts.SortBy,
		"sort_desc": opts.SortDesc,
		"filters":   opts.Filters,
		"facets":    opts.Facets,
	})

	var response SearchResponse[Document]
	err := s.doGet(ctx, path, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to search documents: %w", err)
	}
	return &response, nil
}

// BatchDelete deletes multiple documents
func (s *DocumentService) BatchDelete(ctx context.Context, documentIDs []string) (*BulkDeleteResult, error) {
	req := map[string]interface{}{
		"document_ids": documentIDs,
	}

	var result BulkDeleteResult
	err := s.doPost(ctx, "/batch/delete", req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to batch delete documents: %w", err)
	}
	return &result, nil
}

// GetProcessingStatus gets the processing status of a document
func (s *DocumentService) GetProcessingStatus(ctx context.Context, documentID string) (*ProcessingStatus, error) {
	var status ProcessingStatus
	err := s.doGet(ctx, fmt.Sprintf("/%s/status", documentID), &status)
	if err != nil {
		return nil, fmt.Errorf("failed to get processing status: %w", err)
	}
	return &status, nil
}

// DocumentInfo represents downloaded document information
type DocumentInfo struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

// ProcessingStatus represents document processing status
type ProcessingStatus struct {
	DocumentID string    `json:"document_id"`
	Status     string    `json:"status"`
	Progress   int       `json:"progress"`
	Message    string    `json:"message,omitempty"`
	Error      string    `json:"error,omitempty"`
	StartedAt  Timestamp `json:"started_at"`
	UpdatedAt  Timestamp `json:"updated_at"`
}

// SearchOptions represents search options
type SearchOptions struct {
	Page     int      `json:"page,omitempty"`
	PageSize int      `json:"page_size,omitempty"`
	SortBy   string   `json:"sort_by,omitempty"`
	SortDesc bool     `json:"sort_desc,omitempty"`
	Filters  []Filter `json:"filters,omitempty"`
	Facets   []string `json:"facets,omitempty"`
}

// SearchResponse represents a search response
type SearchResponse[T any] struct {
	Results      []T                    `json:"results"`
	Pagination   Pagination             `json:"pagination"`
	Aggregations map[string]interface{} `json:"aggregations,omitempty"`
	Suggestions  []string               `json:"suggestions,omitempty"`
}

// getContentType determines content type from file extension
func getContentType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".doc", ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".xls", ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".ppt", ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".txt":
		return "text/plain"
	case ".html", ".htm":
		return "text/html"
	case ".md":
		return "text/markdown"
	case ".json":
		return "application/json"
	case ".xml":
		return "application/xml"
	case ".csv":
		return "text/csv"
	default:
		return "application/octet-stream"
	}
}
