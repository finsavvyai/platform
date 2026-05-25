//go:build never
// +build never

package services

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

// DocumentService provides access to document management APIs
type DocumentService struct {
	*sdln.BaseService
}

// NewDocumentService creates a new DocumentService
func NewDocumentService(client *sdln.Client) *DocumentService {
	return &DocumentService{
		BaseService: sdln.NewBaseService(client, "documents", "v1/documents"),
	}
}

// Upload uploads a document file
func (s *DocumentService) Upload(ctx context.Context, filePath string, metadata *sdln.DocumentMetadata) (*sdln.Document, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Create multipart form
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	// Add file
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file content: %w", err)
	}

	// Add metadata
	if metadata != nil {
		metadataWriter, err := writer.CreateFormField("metadata")
		if err != nil {
			return nil, fmt.Errorf("failed to create metadata field: %w", err)
		}

		metadataBytes, err := s.Client().JSONMarshal(metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}

		_, err = metadataWriter.Write(metadataBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to write metadata: %w", err)
		}
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", s.Client().Config.BaseURL+"/v1/documents/upload", &requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+s.Client().Config.APIKey)

	resp, err := s.Client().Do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upload failed with status: %d", resp.StatusCode)
	}

	var result sdln.Document
	err = s.Client().JSONUnmarshal(resp.Body, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// UploadFromBytes uploads a document from byte data
func (s *DocumentService) UploadFromBytes(ctx context.Context, filename string, data []byte, metadata *sdln.DocumentMetadata) (*sdln.Document, error) {
	// Create multipart form
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	// Add file
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = part.Write(data)
	if err != nil {
		return nil, fmt.Errorf("failed to write file content: %w", err)
	}

	// Add metadata
	if metadata != nil {
		metadataWriter, err := writer.CreateFormField("metadata")
		if err != nil {
			return nil, fmt.Errorf("failed to create metadata field: %w", err)
		}

		metadataBytes, err := s.Client().JSONMarshal(metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal metadata: %w", err)
		}

		_, err = metadataWriter.Write(metadataBytes)
		if err != nil {
			return nil, fmt.Errorf("failed to write metadata: %w", err)
		}
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, "POST", s.Client().Config.BaseURL+"/v1/documents/upload", &requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+s.Client().Config.APIKey)

	resp, err := s.Client().Do(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload document: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("upload failed with status: %d", resp.StatusCode)
	}

	var result sdln.Document
	err = s.Client().JSONUnmarshal(resp.Body, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &result, nil
}

// Get retrieves a document by ID
func (s *DocumentService) Get(ctx context.Context, documentID sdln.ID) (*sdln.Document, error) {
	path := fmt.Sprintf("/%s", documentID.String())
	var result sdln.Document
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}
	return &result, nil
}

// Update updates document metadata
func (s *DocumentService) Update(ctx context.Context, documentID sdln.ID, metadata *sdln.DocumentMetadata) (*sdln.Document, error) {
	path := fmt.Sprintf("/%s", documentID.String())
	var result sdln.Document
	err := s.doPut(ctx, path, metadata, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to update document: %w", err)
	}
	return &result, nil
}

// Delete deletes a document
func (s *DocumentService) Delete(ctx context.Context, documentID sdln.ID) error {
	path := fmt.Sprintf("/%s", documentID.String())
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	return nil
}

// List retrieves a list of documents with pagination and filtering
func (s *DocumentService) List(ctx context.Context, opts *sdln.DocumentListOptions) (*sdln.PaginatedResponse[sdln.Document], error) {
	queryParams := make(map[string]interface{})

	if opts != nil {
		if opts.TenantID != "" {
			queryParams["tenant_id"] = opts.TenantID.String()
		}
		if opts.Status != "" {
			queryParams["status"] = opts.Status
		}
		if opts.DocumentType != "" {
			queryParams["document_type"] = opts.DocumentType
		}
		if opts.StartTime != nil {
			queryParams["start_time"] = opts.StartTime.Format(time.RFC3339)
		}
		if opts.EndTime != nil {
			queryParams["end_time"] = opts.EndTime.Format(time.RFC3339)
		}
		if opts.Search != "" {
			queryParams["search"] = opts.Search
		}
		queryParams["page"] = opts.Page
		queryParams["page_size"] = opts.PageSize
		queryParams["sort_by"] = opts.SortBy
		queryParams["sort_desc"] = opts.SortDesc
	}

	query := s.buildQuery(queryParams)
	path := fmt.Sprintf("/%s", query)

	var result sdln.PaginatedResponse[sdln.Document]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	return &result, nil
}

// Download downloads a document file
func (s *DocumentService) Download(ctx context.Context, documentID sdln.ID) (io.ReadCloser, string, error) {
	path := fmt.Sprintf("/%s/download", documentID.String())

	req, err := http.NewRequestWithContext(ctx, "GET", s.Client().Config.BaseURL+"/v1/documents"+path, nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create download request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.Client().Config.APIKey)

	resp, err := s.Client().Do(ctx, req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download document: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, "", fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	return resp.Body, contentType, nil
}

// GetContent retrieves the extracted text content of a document
func (s *DocumentService) GetContent(ctx context.Context, documentID sdln.ID) (*sdln.DocumentContent, error) {
	path := fmt.Sprintf("/%s/content", documentID.String())
	var result sdln.DocumentContent
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document content: %w", err)
	}
	return &result, nil
}

// GetChunks retrieves document chunks
func (s *DocumentService) GetChunks(ctx context.Context, documentID sdln.ID, opts *sdln.ListOptions) (*sdln.PaginatedResponse[sdln.DocumentChunk], error) {
	path := fmt.Sprintf("/%s/chunks", documentID.String())
	if opts != nil {
		path += s.buildQuery(map[string]interface{}{
			"page":      opts.Page,
			"page_size": opts.PageSize,
			"sort_by":   opts.SortBy,
			"sort_desc": opts.SortDesc,
		})
	}

	var result sdln.PaginatedResponse[sdln.DocumentChunk]
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document chunks: %w", err)
	}
	return &result, nil
}

// Process triggers document processing
func (s *DocumentService) Process(ctx context.Context, documentID sdln.ID, options *sdln.ProcessingOptions) (*sdln.ProcessingJob, error) {
	path := fmt.Sprintf("/%s/process", documentID.String())
	var result sdln.ProcessingJob
	err := s.doPost(ctx, path, options, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to start document processing: %w", err)
	}
	return &result, nil
}

// GetProcessingStatus retrieves the status of a document processing job
func (s *DocumentService) GetProcessingStatus(ctx context.Context, jobID string) (*sdln.ProcessingJob, error) {
	path := fmt.Sprintf("/processing/%s", jobID)
	var result sdln.ProcessingJob
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get processing status: %w", err)
	}
	return &result, nil
}

// Search searches for documents based on content and metadata
func (s *DocumentService) Search(ctx context.Context, query string, opts *sdln.SearchOptions) (*sdln.SearchResults, error) {
	path := "/search"
	req := map[string]interface{}{
		"query": query,
	}

	if opts != nil {
		req["tenant_id"] = opts.TenantID.String()
		req["document_types"] = opts.DocumentTypes
		req["limit"] = opts.Limit
		req["offset"] = opts.Offset
		req["filters"] = opts.Filters
	}

	var result sdln.SearchResults
	err := s.doPost(ctx, path, req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to search documents: %w", err)
	}
	return &result, nil
}

// GetVersions retrieves document versions
func (s *DocumentService) GetVersions(ctx context.Context, documentID sdln.ID) ([]sdln.DocumentVersion, error) {
	path := fmt.Sprintf("/%s/versions", documentID.String())
	var result struct {
		Versions []sdln.DocumentVersion `json:"versions"`
	}
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document versions: %w", err)
	}
	return result.Versions, nil
}

// CreateVersion creates a new version of a document
func (s *DocumentService) CreateVersion(ctx context.Context, documentID sdln.ID, filePath string, changeDescription string) (*sdln.DocumentVersion, error) {
	// First upload the new version
	metadata := &sdln.DocumentMetadata{
		ChangeDescription: changeDescription,
	}

	doc, err := s.Upload(ctx, filePath, metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to upload new version: %w", err)
	}

	// Link the new document as a version of the original
	path := fmt.Sprintf("/%s/versions", documentID.String())
	req := map[string]interface{}{
		"version_document_id": doc.ID,
		"change_description":  changeDescription,
	}

	var result sdln.DocumentVersion
	err = s.doPost(ctx, path, req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to create document version: %w", err)
	}
	return &result, nil
}

// RestoreVersion restores a document to a previous version
func (s *DocumentService) RestoreVersion(ctx context.Context, documentID sdln.ID, versionID string) error {
	path := fmt.Sprintf("/%s/versions/%s/restore", documentID.String(), versionID)
	err := s.doPost(ctx, path, nil, nil)
	if err != nil {
		return fmt.Errorf("failed to restore document version: %w", err)
	}
	return nil
}

// GetPermissions retrieves document permissions
func (s *DocumentService) GetPermissions(ctx context.Context, documentID sdln.ID) ([]sdln.DocumentPermission, error) {
	path := fmt.Sprintf("/%s/permissions", documentID.String())
	var result struct {
		Permissions []sdln.DocumentPermission `json:"permissions"`
	}
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document permissions: %w", err)
	}
	return result.Permissions, nil
}

// UpdatePermissions updates document permissions
func (s *DocumentService) UpdatePermissions(ctx context.Context, documentID sdln.ID, permissions []sdln.DocumentPermission) error {
	path := fmt.Sprintf("/%s/permissions", documentID.String())
	req := map[string]interface{}{
		"permissions": permissions,
	}
	err := s.doPut(ctx, path, req, nil)
	if err != nil {
		return fmt.Errorf("failed to update document permissions: %w", err)
	}
	return nil
}

// Share shares a document with users or tenants
func (s *DocumentService) Share(ctx context.Context, documentID sdln.ID, shareReq *sdln.ShareRequest) (*sdln.ShareResult, error) {
	path := fmt.Sprintf("/%s/share", documentID.String())
	var result sdln.ShareResult
	err := s.doPost(ctx, path, shareReq, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to share document: %w", err)
	}
	return &result, nil
}

// Unshare removes sharing for a document
func (s *DocumentService) Unshare(ctx context.Context, documentID sdln.ID, targetID sdln.ID, targetType string) error {
	path := fmt.Sprintf("/%s/share/%s/%s", documentID.String(), targetType, targetID.String())
	err := s.doDelete(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to unshare document: %w", err)
	}
	return nil
}

// GetAnalytics retrieves document analytics
func (s *DocumentService) GetAnalytics(ctx context.Context, documentID sdln.ID, timeRange string) (*sdln.DocumentAnalytics, error) {
	path := fmt.Sprintf("/%s/analytics", documentID.String())
	if timeRange != "" {
		path += fmt.Sprintf("?range=%s", timeRange)
	}

	var result sdln.DocumentAnalytics
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get document analytics: %w", err)
	}
	return &result, nil
}

// BatchProcess processes multiple documents in bulk
func (s *DocumentService) BatchProcess(ctx context.Context, documentIDs []sdln.ID, options *sdln.ProcessingOptions) (*sdln.BatchProcessingJob, error) {
	path := "/batch-process"
	req := map[string]interface{}{
		"document_ids": documentIDs,
		"options":      options,
	}

	var result sdln.BatchProcessingJob
	err := s.doPost(ctx, path, req, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to start batch processing: %w", err)
	}
	return &result, nil
}

// GetBatchProcessingStatus retrieves the status of a batch processing job
func (s *DocumentService) GetBatchProcessingStatus(ctx context.Context, jobID string) (*sdln.BatchProcessingJob, error) {
	path := fmt.Sprintf("/batch-processing/%s", jobID)
	var result sdln.BatchProcessingJob
	err := s.doGet(ctx, path, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to get batch processing status: %w", err)
	}
	return &result, nil
}
