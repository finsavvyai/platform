//go:build ignore

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/render"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/models"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
)

// FileUploadHandler handles file upload operations
type FileUploadHandler struct {
	fileUploadService *services.FileUploadService
	storageProvider   storage.StorageProvider
	logger            *logrus.Logger
}

// NewFileUploadHandler creates a new file upload handler
func NewFileUploadHandler(
	fileUploadService *services.FileUploadService,
	storageProvider storage.StorageProvider,
	logger *logrus.Logger,
) *FileUploadHandler {
	return &FileUploadHandler{
		fileUploadService: fileUploadService,
		storageProvider:   storageProvider,
		logger:            logger,
	}
}

// UploadFile handles file upload requests
func (h *FileUploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "UploadFile")
	defer span.End()

	// Get tenant and user context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse multipart form (max 100MB)
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}

	// Get file from form
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "No file provided")
		return
	}
	defer file.Close()

	// Read file content
	content := make([]byte, fileHeader.Size)
	if _, err := file.Read(content); err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Failed to read file content")
		return
	}

	// Parse additional form fields
	accessLevel := r.FormValue("access_level")
	classification := r.FormValue("classification")

	var tags []string
	if tagsStr := r.FormValue("tags"); tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i, tag := range tags {
			tags[i] = strings.TrimSpace(tag)
		}
	}

	// Parse retention policy if provided
	var retentionPolicy *models.RetentionPolicy
	if retentionStr := r.FormValue("retention_policy"); retentionStr != "" {
		var policy models.RetentionPolicy
		if err := json.Unmarshal([]byte(retentionStr), &policy); err != nil {
			h.logger.WithError(err).Warn("Failed to parse retention policy, using default")
		} else {
			retentionPolicy = &policy
		}
	}

	// Create upload request
	req := &services.UploadRequest{
		TenantID:        tenantID,
		UserID:          userID,
		OriginalName:    fileHeader.Filename,
		Content:         content,
		ContentType:     fileHeader.Header.Get("Content-Type"),
		AccessLevel:     accessLevel,
		Classification:  classification,
		Tags:            tags,
		RetentionPolicy: retentionPolicy,
	}

	// Process upload
	result, err := h.fileUploadService.UploadFile(ctx, req)
	if err != nil {
		h.HandleError(w, r, err, http.StatusInternalServerError, "File upload failed")
		return
	}

	h.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"user_id":     userID,
		"document_id": result.DocumentID,
		"filename":    result.Filename,
		"file_size":   result.FileSize,
	}).Info("File uploaded successfully")

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// UploadMultipleFiles handles multiple file upload requests
func (h *FileUploadHandler) UploadMultipleFiles(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "UploadMultipleFiles")
	defer span.End()

	// Get tenant and user context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(500 << 20); err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Failed to parse multipart form")
		return
	}

	// Get files from form
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		h.HandleError(w, r, fmt.Errorf("no files provided"), http.StatusBadRequest, "No files provided")
		return
	}

	// Parse common form fields
	accessLevel := r.FormValue("access_level")
	classification := r.FormValue("classification")

	var tags []string
	if tagsStr := r.FormValue("tags"); tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i, tag := range tags {
			tags[i] = strings.TrimSpace(tag)
		}
	}

	var retentionPolicy *models.RetentionPolicy
	if retentionStr := r.FormValue("retention_policy"); retentionStr != "" {
		var policy models.RetentionPolicy
		if err := json.Unmarshal([]byte(retentionStr), &policy); err != nil {
			h.logger.WithError(err).Warn("Failed to parse retention policy, using default")
		} else {
			retentionPolicy = &policy
		}
	}

	// Process each file
	results := make([]*services.UploadResponse, 0, len(files))
	errors := make([]map[string]interface{}, 0)

	for i, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			errors = append(errors, map[string]interface{}{
				"index":    i,
				"filename": fileHeader.Filename,
				"error":    err.Error(),
			})
			continue
		}

		content := make([]byte, fileHeader.Size)
		if _, err := file.Read(content); err != nil {
			file.Close()
			errors = append(errors, map[string]interface{}{
				"index":    i,
				"filename": fileHeader.Filename,
				"error":    err.Error(),
			})
			continue
		}
		file.Close()

		// Create upload request
		req := &services.UploadRequest{
			TenantID:        tenantID,
			UserID:          userID,
			OriginalName:    fileHeader.Filename,
			Content:         content,
			ContentType:     fileHeader.Header.Get("Content-Type"),
			AccessLevel:     accessLevel,
			Classification:  classification,
			Tags:            tags,
			RetentionPolicy: retentionPolicy,
		}

		// Process upload
		result, err := h.fileUploadService.UploadFile(ctx, req)
		if err != nil {
			errors = append(errors, map[string]interface{}{
				"index":    i,
				"filename": fileHeader.Filename,
				"error":    err.Error(),
			})
			continue
		}

		results = append(results, result)
	}

	h.logger.WithFields(logrus.Fields{
		"tenant_id":      tenantID,
		"user_id":        userID,
		"total_files":    len(files),
		"uploaded_files": len(results),
		"failed_files":   len(errors),
	}).Info("Multiple files upload completed")

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"uploaded": results,
			"failed":   errors,
			"summary": map[string]int{
				"total":    len(files),
				"uploaded": len(results),
				"failed":   len(errors),
			},
		},
	})
}

// GetFile retrieves a file from storage
func (h *FileUploadHandler) GetFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "GetFile")
	defer span.End()

	// Get tenant and user context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get file parameters from URL
	documentIDStr := r.URL.Query().Get("document_id")
	filename := r.URL.Query().Get("filename")

	if documentIDStr == "" || filename == "" {
		h.HandleError(w, r, fmt.Errorf("missing required parameters"), http.StatusBadRequest, "document_id and filename are required")
		return
	}

	documentID, err := uuid.Parse(documentIDStr)
	if err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Invalid document ID")
		return
	}

	// Retrieve file from storage
	content, err := h.storageProvider.Retrieve(ctx, tenantID.String(), documentID.String(), filename)
	if err != nil {
		h.HandleError(w, r, err, http.StatusNotFound, "File not found")
		return
	}

	// Set content type
	if contentType := r.URL.Query().Get("content_type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}

	// Set content disposition
	if download := r.URL.Query().Get("download"); download == "true" {
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	}

	// Write content
	w.WriteHeader(http.StatusOK)
	w.Write(content)

	h.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"document_id": documentID,
		"filename":    filename,
		"size":        len(content),
	}).Debug("File retrieved successfully")
}

// DeleteFile deletes a file from storage
func (h *FileUploadHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "DeleteFile")
	defer span.End()

	// Get tenant and user context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get file parameters from URL
	documentIDStr := r.URL.Query().Get("document_id")
	filename := r.URL.Query().Get("filename")

	if documentIDStr == "" || filename == "" {
		h.HandleError(w, r, fmt.Errorf("missing required parameters"), http.StatusBadRequest, "document_id and filename are required")
		return
	}

	documentID, err := uuid.Parse(documentIDStr)
	if err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Invalid document ID")
		return
	}

	// Delete file from storage
	err = h.storageProvider.Delete(ctx, tenantID.String(), documentID.String(), filename)
	if err != nil {
		h.HandleError(w, r, err, http.StatusInternalServerError, "Failed to delete file")
		return
	}

	h.logger.WithFields(logrus.Fields{
		"tenant_id":   tenantID,
		"document_id": documentID,
		"filename":    filename,
	}).Info("File deleted successfully")

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"message": "File deleted successfully",
	})
}

// ListFiles lists files for a tenant with optional filtering
func (h *FileUploadHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "ListFiles")
	defer span.End()

	// Get tenant context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Parse query parameters
	filter := storage.ListFilter{
		Prefix: r.URL.Query().Get("prefix"),
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil && limit > 0 {
			filter.Limit = limit
		}
	}

	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil && offset >= 0 {
			filter.Offset = offset
		}
	}

	if contentType := r.URL.Query().Get("content_type"); contentType != "" {
		filter.ContentType = &contentType
	}

	if tagsStr := r.URL.Query().Get("tags"); tagsStr != "" {
		filter.Tags = strings.Split(tagsStr, ",")
		for i, tag := range filter.Tags {
			filter.Tags[i] = strings.TrimSpace(tag)
		}
	}

	// List files from storage
	files, err := h.storageProvider.ListFiles(ctx, tenantID.String(), filter)
	if err != nil {
		h.HandleError(w, r, err, http.StatusInternalServerError, "Failed to list files")
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"files": files,
			"count": len(files),
		},
	})
}

// GetSupportedFormats returns the list of supported file formats
func (h *FileUploadHandler) GetSupportedFormats(w http.ResponseWriter, r *http.Request) {
	formats := h.fileUploadService.GetSupportedFormats()
	maxFileSize := h.fileUploadService.GetMaxFileSize()

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"supported_formats": formats,
			"max_file_size":     maxFileSize,
			"max_file_size_mb":  maxFileSize / (1024 * 1024),
		},
	})
}

// CheckFileExists checks if a file exists in storage
func (h *FileUploadHandler) CheckFileExists(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "CheckFileExists")
	defer span.End()

	// Get tenant context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get file parameters from URL
	documentIDStr := r.URL.Query().Get("document_id")
	filename := r.URL.Query().Get("filename")

	if documentIDStr == "" || filename == "" {
		h.HandleError(w, r, fmt.Errorf("missing required parameters"), http.StatusBadRequest, "document_id and filename are required")
		return
	}

	documentID, err := uuid.Parse(documentIDStr)
	if err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Invalid document ID")
		return
	}

	// Check if file exists
	exists, err := h.storageProvider.Exists(ctx, tenantID.String(), documentID.String(), filename)
	if err != nil {
		h.HandleError(w, r, err, http.StatusInternalServerError, "Failed to check file existence")
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"exists": exists,
		},
	})
}

// GetFileMetadata retrieves metadata for a file
func (h *FileUploadHandler) GetFileMetadata(w http.ResponseWriter, r *http.Request) {
	ctx, span := otel.Tracer("file-upload-handler").Start(r.Context(), "GetFileMetadata")
	defer span.End()

	// Get tenant context from request
	tenantID, err := h.getTenantIDFromContext(r)
	if err != nil {
		h.HandleError(w, r, err, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get file parameters from URL
	documentIDStr := r.URL.Query().Get("document_id")
	filename := r.URL.Query().Get("filename")

	if documentIDStr == "" || filename == "" {
		h.HandleError(w, r, fmt.Errorf("missing required parameters"), http.StatusBadRequest, "document_id and filename are required")
		return
	}

	documentID, err := uuid.Parse(documentIDStr)
	if err != nil {
		h.HandleError(w, r, err, http.StatusBadRequest, "Invalid document ID")
		return
	}

	// Get file metadata
	metadata, err := h.storageProvider.GetMetadata(ctx, tenantID.String(), documentID.String(), filename)
	if err != nil {
		h.HandleError(w, r, err, http.StatusNotFound, "File metadata not found")
		return
	}

	render.JSON(w, r, map[string]interface{}{
		"success": true,
		"data":    metadata,
	})
}

// Helper methods

// getTenantIDFromContext extracts tenant ID from request context
func (h *FileUploadHandler) getTenantIDFromContext(r *http.Request) (uuid.UUID, error) {
	tenantIDStr := r.Header.Get("X-Tenant-ID")
	if tenantIDStr == "" {
		return uuid.Nil, fmt.Errorf("tenant ID not found in request")
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid tenant ID format")
	}

	return tenantID, nil
}

// getUserIDFromContext extracts user ID from request context
func (h *FileUploadHandler) getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	// This would typically come from JWT token claims
	// For now, we'll use a header (in production, extract from JWT)
	userIDStr := r.Header.Get("X-User-ID")
	if userIDStr == "" {
		return uuid.Nil, fmt.Errorf("user ID not found in request")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID format")
	}

	return userID, nil
}
