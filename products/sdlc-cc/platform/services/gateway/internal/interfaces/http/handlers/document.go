package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
)

// UploadDocumentRequest represents the multipart upload request
type UploadDocumentRequest struct {
	File              *multipartHeader       `json:"-"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
	ProcessingOptions ProcessingOptions      `json:"processing_options,omitempty"`
	RetentionPolicy   RetentionPolicy        `json:"retention_policy,omitempty"`
	Classification    string                 `json:"classification,omitempty"`
}

// ProcessingOptions represents document processing options
type ProcessingOptions struct {
	EnableDLP        bool   `json:"enable_dlp"`
	ChunkingStrategy string `json:"chunking_strategy"`
	ChunkSize        int    `json:"chunk_size"`
	ChunkOverlap     int    `json:"chunk_overlap"`
	AutoIngest       bool   `json:"auto_ingest"`
}

// RetentionPolicy represents document retention policy
type RetentionPolicy struct {
	RetentionDays int  `json:"retention_days"`
	AutoDelete    bool `json:"auto_delete"`
}

// UpdateDocumentRequest represents the request to update document metadata
type UpdateDocumentRequest struct {
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	Classification  *string                `json:"classification,omitempty"`
	RetentionPolicy *RetentionPolicy       `json:"retention_policy,omitempty"`
}

// DocumentListResponse represents the response for listing documents
type DocumentListResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Documents  []map[string]interface{} `json:"documents"`
		Pagination PaginationInfo           `json:"pagination"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// DocumentResponse represents a single document response
type DocumentResponse struct {
	Success bool                   `json:"success"`
	Data    map[string]interface{} `json:"data"`
	Meta    ResponseMeta           `json:"meta"`
}

// DocumentProcessingResponse represents the document upload/processing response
type DocumentProcessingResponse struct {
	Success bool `json:"success"`
	Data    struct {
		DocumentID              uuid.UUID         `json:"document_id"`
		ProcessingStatus        string            `json:"processing_status"`
		EstimatedCompletionTime time.Time         `json:"estimated_completion_time,omitempty"`
		ProcessingOptions       ProcessingOptions `json:"processing_options,omitempty"`
	} `json:"data"`
	Meta ResponseMeta `json:"meta"`
}

// ListDocuments handles listing documents with filtering and pagination
func ListDocuments(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "ListDocuments")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get user to check permissions and tenant
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Parse query parameters
		limit := parseIntQueryParam(r, "limit", 50)
		offset := parseIntQueryParam(r, "offset", 0)
		search := r.URL.Query().Get("search")
		contentType := r.URL.Query().Get("content_type")
		status := r.URL.Query().Get("status")
		createdAfter := r.URL.Query().Get("created_after")
		createdBefore := r.URL.Query().Get("created_before")

		// Validate limit
		if limit > 1000 {
			limit = 1000
		}
		if limit < 1 {
			limit = 50
		}

		// Build filter
		filter := &models.DocumentFilter{
			TenantID: &user.TenantID,
			Limit:    &limit,
			Offset:   &offset,
		}

		if contentType != "" {
			filter.ContentType = &contentType
		}

		if status != "" {
			if docStatus := parseDocumentStatus(status); docStatus != "" {
				filter.ExtractionStatus = &docStatus
			}
		}

		if search != "" {
			filter.Search = &search
		}

		if createdAfter != "" {
			if t, err := time.Parse(time.RFC3339, createdAfter); err == nil {
				filter.CreatedAfter = &t
			}
		}

		if createdBefore != "" {
			if t, err := time.Parse(time.RFC3339, createdBefore); err == nil {
				filter.CreatedBefore = &t
			}
		}

		// Get documents
		documents, err := deps.Repos.Document.GetByTenant(ctx, user.TenantID, *filter)
		if err != nil {
			logrus.WithError(err).Error("Failed to list documents")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to list documents", requestID)
			return
		}

		// Get total count
		total, err := deps.Repos.Document.GetDocumentCount(ctx, user.TenantID)
		if err != nil {
			logrus.WithError(err).Warn("Failed to get document count")
			total = len(documents)
		}

		// Convert to response format
		documentList := make([]map[string]interface{}, 0, len(documents))
		for _, doc := range documents {
			documentList = append(documentList, convertDocumentToMap(doc))
		}

		// Calculate pagination
		totalPages := (total + limit - 1) / limit
		currentPage := (offset / limit) + 1

		response := DocumentListResponse{
			Success: true,
		}
		response.Data.Documents = documentList
		response.Data.Pagination = PaginationInfo{
			Total:       total,
			Limit:       limit,
			Offset:      offset,
			HasNext:     offset+limit < total,
			HasPrev:     offset > 0,
			TotalPages:  totalPages,
			CurrentPage: currentPage,
		}
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// UploadDocument handles document upload
func UploadDocument(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, span := otel.Tracer("gateway").Start(r.Context(), "UploadDocument")
		defer span.End()
		respondWithError(w, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Document upload pending FileUploadService wiring (#gateway-handlers)", uuid.New().String())
	}
}

// GetDocument handles getting a specific document
func GetDocument(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "GetDocument")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get document ID from URL
		documentIDStr := chi.URLParam(r, "id")
		documentID, err := uuid.Parse(documentIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid document ID", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get document
		document, err := deps.Repos.Document.GetByID(ctx, documentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Document not found", requestID)
			return
		}

		// Check tenant access
		if user.TenantID != document.TenantID && user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to access this document", requestID)
			return
		}

		// Check document access permissions
		if !document.CanAccess(user.Role) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "Your role does not grant access to this document", requestID)
			return
		}

		response := DocumentResponse{
			Success: true,
		}
		response.Data = convertDocumentToMap(document)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)
	}
}

// GetDocumentContent handles getting document content
func GetDocumentContent(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "GetDocumentContent")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get document ID from URL
		documentIDStr := chi.URLParam(r, "id")
		documentID, err := uuid.Parse(documentIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid document ID", requestID)
			return
		}

		// Get format parameter
		format := r.URL.Query().Get("format")
		if format == "" {
			format = "original"
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get document
		document, err := deps.Repos.Document.GetByID(ctx, documentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Document not found", requestID)
			return
		}

		// Check permissions
		if user.TenantID != document.TenantID && user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to access this document", requestID)
			return
		}

		if !document.CanAccess(user.Role) {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "Your role does not grant access to this document", requestID)
			return
		}

		// Retrieve file content
		content, err := deps.StorageProvider.Retrieve(ctx, document.TenantID.String(), document.ID.String(), document.Filename)
		if err != nil {
			logrus.WithError(err).Error("Failed to retrieve document content")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve document content", requestID)
			return
		}

		// Set response headers based on format. Always force download semantics
		// and disable MIME sniffing so the browser cannot render attacker-controlled
		// document content as HTML/JS (mitigates G705 XSS).
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", document.OriginalFilename))
		switch format {
		case "original":
			w.Header().Set("Content-Type", document.ContentType)
		case "text":
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		case "json":
			w.Header().Set("Content-Type", "application/json")
		}

		w.WriteHeader(http.StatusOK)
		// XSS via taint analysis is mitigated by X-Content-Type-Options: nosniff
		// and Content-Disposition: attachment set above; the browser will not
		// execute the body as HTML/JS. Write error after headers is non-actionable.
		// #nosec G705 -- nosniff + attachment forces download, prevents XSS rendering
		if _, err := w.Write(content); err != nil {
			logrus.WithError(err).WithField("document_id", documentID).Debug("Failed to write document body")
		}

		logrus.WithFields(logrus.Fields{
			"document_id": documentID,
			"user_id":     userID,
			"format":      format,
			"request_id":  requestID,
		}).Debug("Document content retrieved")
	}
}

// UpdateDocument handles updating document metadata
func UpdateDocument(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "UpdateDocument")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get document ID from URL
		documentIDStr := chi.URLParam(r, "id")
		documentID, err := uuid.Parse(documentIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid document ID", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get document
		document, err := deps.Repos.Document.GetByID(ctx, documentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Document not found", requestID)
			return
		}

		// Check permissions
		if user.TenantID != document.TenantID && user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to update this document", requestID)
			return
		}

		if !user.HasPermission("documents:write") {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to update documents", requestID)
			return
		}

		var req UpdateDocumentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request body", requestID)
			return
		}

		// Build updates
		updates := make(map[string]interface{})

		if req.Metadata != nil {
			document.Metadata = models.JSONB(req.Metadata)
			updates["metadata"] = req.Metadata
		}

		if req.Classification != nil {
			document.Classification = models.DataClassification(*req.Classification)
			updates["classification"] = *req.Classification
		}

		if req.RetentionPolicy != nil {
			// Convert to JSONB format
			rp := models.JSONB{
				"retention_days": req.RetentionPolicy.RetentionDays,
				"auto_delete":    req.RetentionPolicy.AutoDelete,
			}
			document.RetentionPolicy = rp
			updates["retention_policy"] = rp
		}

		if err := deps.Repos.Document.Update(ctx, documentID, updates); err != nil {
			logrus.WithError(err).Error("Failed to update document")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update document", requestID)
			return
		}

		// Refresh document data
		document, _ = deps.Repos.Document.GetByID(ctx, documentID)

		response := DocumentResponse{
			Success: true,
		}
		response.Data = convertDocumentToMap(document)
		response.Meta = ResponseMeta{
			RequestID: requestID,
			Timestamp: timestampNow(),
			Version:   deps.Config.Version,
		}

		renderJSON(w, http.StatusOK, response)

		logrus.WithFields(logrus.Fields{
			"document_id": documentID,
			"updated_by":  userID,
			"request_id":  requestID,
		}).Info("Document updated successfully")
	}
}

// DeleteDocument handles deleting a document
func DeleteDocument(deps *Dependencies) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, span := otel.Tracer("gateway").Start(r.Context(), "DeleteDocument")
		defer span.End()

		requestID := uuid.New().String()

		// Get user info from context
		userID, ok := ctx.Value("user_id").(uuid.UUID)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", requestID)
			return
		}

		// Get document ID from URL
		documentIDStr := chi.URLParam(r, "id")
		documentID, err := uuid.Parse(documentIDStr)
		if err != nil {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid document ID", requestID)
			return
		}

		// Get user to check permissions
		user, err := deps.Repos.User.GetByID(ctx, userID)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Failed to verify user permissions", requestID)
			return
		}

		// Get document
		document, err := deps.Repos.Document.GetByID(ctx, documentID)
		if err != nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "Document not found", requestID)
			return
		}

		// Check permissions
		if user.TenantID != document.TenantID && user.Role != models.RoleSuperAdmin {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to delete this document", requestID)
			return
		}

		if !user.HasPermission("documents:delete") {
			respondWithError(w, http.StatusForbidden, "PERMISSION_DENIED", "You don't have permission to delete documents", requestID)
			return
		}

		// Delete from storage
		if err := deps.StorageProvider.Delete(ctx, document.TenantID.String(), document.ID.String(), document.Filename); err != nil {
			logrus.WithError(err).Error("Failed to delete document from storage")
			// Continue with database deletion
		}

		// Delete from database
		if err := deps.Repos.Document.Delete(ctx, documentID); err != nil {
			logrus.WithError(err).Error("Failed to delete document from database")
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to delete document", requestID)
			return
		}

		// Delete associated chunks
		if err := deps.Repos.DocumentChunk.DeleteByDocument(ctx, documentID); err != nil {
			logrus.WithError(err).Warn("Failed to delete document chunks")
		}

		w.WriteHeader(http.StatusNoContent)

		logrus.WithFields(logrus.Fields{
			"document_id": documentID,
			"deleted_by":  userID,
			"request_id":  requestID,
		}).Info("Document deleted successfully")
	}
}

// Helper functions

func convertDocumentToMap(doc *models.Document) map[string]interface{} {
	metadata := make(map[string]interface{})
	if doc.Metadata != nil {
		metadata = doc.Metadata
	}

	retentionPolicy := make(map[string]interface{})
	if doc.RetentionPolicy != nil {
		retentionPolicy = doc.RetentionPolicy
	}

	tags := []string{}
	if doc.Tags != nil {
		if tagList, ok := doc.Tags["tags"].([]interface{}); ok {
			for _, tag := range tagList {
				if tagStr, ok := tag.(string); ok {
					tags = append(tags, tagStr)
				}
			}
		}
	}

	processingInfo := map[string]interface{}{
		"chunks_count":       0,
		"processing_time_ms": doc.ProcessingDurationMs,
		"dlp_scan_passed":    doc.DLPStatus == models.DocumentStatusCompleted,
	}

	return map[string]interface{}{
		"id":                   doc.ID,
		"tenant_id":            doc.TenantID,
		"filename":             doc.Filename,
		"original_filename":    doc.OriginalFilename,
		"content_type":         doc.ContentType,
		"file_size":            doc.FileSize,
		"checksum":             doc.Checksum,
		"storage_path":         doc.StoragePath,
		"storage_bucket":       doc.StorageBucket,
		"storage_provider":     doc.StorageProvider,
		"metadata":             metadata,
		"extraction_status":    string(doc.ExtractionStatus),
		"processing_status":    string(doc.ProcessingStatus),
		"dlp_status":           string(doc.DLPStatus),
		"created_at":           doc.CreatedAt,
		"updated_at":           doc.UpdatedAt,
		"created_by":           doc.CreatedBy,
		"encryption_key_id":    doc.EncryptionKeyID,
		"encryption_algorithm": string(doc.EncryptionAlgorithm),
		"retention_policy":     retentionPolicy,
		"access_level":         doc.AccessLevel,
		"tags":                 tags,
		"classification":       string(doc.Classification),
		"content_hash":         doc.ContentHash,
		"language":             doc.Language,
		"processing_info":      processingInfo,
	}
}

func parseDocumentStatus(status string) models.DocumentStatus {
	switch models.DocumentStatus(status) {
	case models.DocumentStatusPending, models.DocumentStatusProcessing,
		models.DocumentStatusCompleted, models.DocumentStatusFailed, models.DocumentStatusArchived:
		return models.DocumentStatus(status)
	}
	return ""
}

// multipartHeader is a placeholder for multipart file header info
type multipartHeader struct {
	Filename string
	Size     int64
}

// renderJSON is a helper to render JSON responses
func renderJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// Encode error after headers/status sent is non-actionable for the client.
	_ = json.NewEncoder(w).Encode(data)
}
