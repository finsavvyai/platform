//go:build ignore

package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/services"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
)

// FileManagementHandler handles file management API endpoints
type FileManagementHandler struct {
	multipartUploadService *services.MultiPartUploadService
	fileUploadService      *services.FileUploadService
	accessControl          *storage.AccessControlService
	metadataExtractor      storage.MetadataExtractor
	logger                 *logrus.Logger
	tracer                 trace.Tracer
}

// NewFileManagementHandler creates a new file management handler
func NewFileManagementHandler(
	multipartUploadService *services.MultiPartUploadService,
	fileUploadService *services.FileUploadService,
	accessControl *storage.AccessControlService,
	metadataExtractor storage.MetadataExtractor,
	logger *logrus.Logger,
) *FileManagementHandler {
	return &FileManagementHandler{
		multipartUploadService: multipartUploadService,
		fileUploadService:      fileUploadService,
		accessControl:          accessControl,
		metadataExtractor:      metadataExtractor,
		logger:                 logger,
	}
}

// InitiateMultipartUpload initiates a multipart upload session
// @Summary Initiate multipart upload
// @Description Starts a new multipart upload session for large files
// @Tags files
// @Accept json
// @Produce json
// @Param request body services.InitiateUploadRequest true "Upload initiation request"
// @Success 201 {object} services.UploadSession
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/multipart/initiate [post]
func (h *FileManagementHandler) InitiateMultipartUpload(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "InitiateMultipartUpload")
	defer span.End()

	var req services.InitiateUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate request
	if err := h.validateInitiateUploadRequest(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Validation failed", err)
		return
	}

	// Check access control
	accessReq := &storage.AccessRequest{
		TenantID: req.TenantID,
		UserID:   req.UserID,
		Action:   storage.ActionWrite,
		Context: storage.RequestContext{
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
			Timestamp: time.Now(),
		},
	}

	decision, err := h.accessControl.CanAccess(ctx, accessReq)
	if err != nil || !decision.Allowed {
		h.writeErrorResponse(w, http.StatusForbidden, "Access denied", fmt.Errorf(decision.Reason))
		return
	}

	// Initiate upload
	session, err := h.multipartUploadService.InitiateUpload(ctx, &req)
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to initiate upload", err)
		return
	}

	h.writeJSONResponse(w, http.StatusCreated, session)
}

// UploadChunk uploads a single chunk
// @Summary Upload chunk
// @Description Uploads a single chunk of a multipart upload
// @Tags files
// @Accept json
// @Produce json
// @Param sessionId path string true "Upload session ID"
// @Param request body services.UploadChunkRequest true "Chunk upload request"
// @Success 200 {object} services.ChunkInfo
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/multipart/{sessionId}/chunks [post]
func (h *FileManagementHandler) UploadChunk(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "UploadChunk")
	defer span.End()

	vars := mux.Vars(r)
	sessionIDStr := vars["sessionId"]
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid session ID", err)
		return
	}

	var req services.UploadChunkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	req.SessionID = sessionID

	// Get session to check permissions
	sessions, err := h.multipartUploadService.ListUploadSessions(ctx, uuid.MustParse(""))
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to get sessions", err)
		return
	}

	var session *services.UploadSession
	for _, s := range sessions {
		if s.ID == sessionID {
			session = s
			break
		}
	}

	if session == nil {
		h.writeErrorResponse(w, http.StatusNotFound, "Upload session not found", nil)
		return
	}

	// Check access control
	accessReq := &storage.AccessRequest{
		TenantID:   session.TenantID,
		UserID:     session.UserID,
		DocumentID: sessionID,
		Action:     storage.ActionWrite,
		Context: storage.RequestContext{
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
			Timestamp: time.Now(),
		},
	}

	decision, err := h.accessControl.CanAccess(ctx, accessReq)
	if err != nil || !decision.Allowed {
		h.writeErrorResponse(w, http.StatusForbidden, "Access denied", fmt.Errorf(decision.Reason))
		return
	}

	// Upload chunk
	chunkInfo, err := h.multipartUploadService.UploadChunk(ctx, &req)
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to upload chunk", err)
		return
	}

	h.writeJSONResponse(w, http.StatusOK, chunkInfo)
}

// CompleteMultipartUpload completes a multipart upload
// @Summary Complete multipart upload
// @Description Completes a multipart upload session
// @Tags files
// @Accept json
// @Produce json
// @Param sessionId path string true "Upload session ID"
// @Success 200 {object} services.UploadResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/multipart/{sessionId}/complete [post]
func (h *FileManagementHandler) CompleteMultipartUpload(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "CompleteMultipartUpload")
	defer span.End()

	vars := mux.Vars(r)
	sessionIDStr := vars["sessionId"]
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid session ID", err)
		return
	}

	// Complete upload
	response, err := h.multipartUploadService.CompleteUpload(ctx, sessionID)
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to complete upload", err)
		return
	}

	h.writeJSONResponse(w, http.StatusOK, response)
}

// GetUploadProgress gets upload progress
// @Summary Get upload progress
// @Description Gets the progress of a multipart upload
// @Tags files
// @Produce json
// @Param sessionId path string true "Upload session ID"
// @Success 200 {object} services.UploadProgress
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/multipart/{sessionId}/progress [get]
func (h *FileManagementHandler) GetUploadProgress(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "GetUploadProgress")
	defer span.End()

	vars := mux.Vars(r)
	sessionIDStr := vars["sessionId"]
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid session ID", err)
		return
	}

	progress, err := h.multipartUploadService.GetUploadProgress(ctx, sessionID)
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to get upload progress", err)
		return
	}

	h.writeJSONResponse(w, http.StatusOK, progress)
}

// ListFiles lists files with filtering
// @Summary List files
// @Description Lists files with optional filtering and pagination
// @Tags files
// @Produce json
// @Param tenantId query string true "Tenant ID"
// @Param limit query int false "Maximum number of files to return"
// @Param offset query int false "Number of files to skip"
// @Param search query string false "Search term"
// @Param contentType query string false "Filter by content type"
// @Param tags query string false "Filter by tags (comma-separated)"
// @Success 200 {object} FileListResponse
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files [get]
func (h *FileManagementHandler) ListFiles(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "ListFiles")
	defer span.End()

	// Parse query parameters
	tenantIDStr := r.URL.Query().Get("tenantId")
	if tenantIDStr == "" {
		h.writeErrorResponse(w, http.StatusBadRequest, "Tenant ID is required", nil)
		return
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid tenant ID", err)
		return
	}

	limit := parseIntQueryParam(r, "limit", 50)
	offset := parseIntQueryParam(r, "offset", 0)
	search := r.URL.Query().Get("search")
	contentType := r.URL.Query().Get("contentType")
	tags := parseCommaSeparatedParam(r, "tags")

	// TODO: Implement actual file listing from database
	// This would involve querying the documents table with filters

	files := []FileInfo{
		{
			ID:               uuid.New(),
			Filename:         "example.pdf",
			OriginalFilename: "example.pdf",
			ContentType:      "application/pdf",
			FileSize:         1024 * 1024,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
			Tags:             []string{"document", "important"},
		},
	}

	response := FileListResponse{
		Files:  files,
		Total:  len(files),
		Limit:  limit,
		Offset: offset,
	}

	h.writeJSONResponse(w, http.StatusOK, response)
}

// GetFile gets file details
// @Summary Get file
// @Description Gets detailed information about a specific file
// @Tags files
// @Produce json
// @Param fileId path string true "File ID"
// @Success 200 {object} FileDetailsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId} [get]
func (h *FileManagementHandler) GetFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "GetFile")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// TODO: Implement actual file retrieval from database
	// This would involve querying the documents table

	file := FileDetailsResponse{
		ID:               fileID,
		Filename:         "example.pdf",
		OriginalFilename: "example.pdf",
		ContentType:      "application/pdf",
		FileSize:         1024 * 1024,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Tags:             []string{"document", "important"},
		Metadata: map[string]interface{}{
			"page_count": 10,
			"author":     "John Doe",
		},
	}

	h.writeJSONResponse(w, http.StatusOK, file)
}

// UpdateFile updates file metadata
// @Summary Update file
// @Description Updates file metadata and properties
// @Tags files
// @Accept json
// @Produce json
// @Param fileId path string true "File ID"
// @Param request body UpdateFileRequest true "Update request"
// @Success 200 {object} FileDetailsResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId} [put]
func (h *FileManagementHandler) UpdateFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "UpdateFile")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	var req UpdateFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// TODO: Implement actual file update in database
	// This would involve updating the documents table

	file := FileDetailsResponse{
		ID:               fileID,
		Filename:         req.Filename,
		OriginalFilename: "example.pdf",
		ContentType:      "application/pdf",
		FileSize:         1024 * 1024,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
		Tags:             req.Tags,
		Metadata:         req.Metadata,
	}

	h.writeJSONResponse(w, http.StatusOK, file)
}

// DeleteFile deletes a file
// @Summary Delete file
// @Description Deletes a file and all associated data
// @Tags files
// @Param fileId path string true "File ID"
// @Success 204
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId} [delete]
func (h *FileManagementHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "DeleteFile")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// TODO: Implement actual file deletion
	// This would involve:
	// 1. Checking access permissions
	// 2. Deleting from storage
	// 3. Deleting from database
	// 4. Cleaning up related data (chunks, embeddings, etc.)

	w.WriteHeader(http.StatusNoContent)
}

// DownloadFile downloads a file
// @Summary Download file
// @Description Downloads a file's content
// @Tags files
// @Produce application/octet-stream
// @Param fileId path string true "File ID"
// @Success 200 {file} binary
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId}/download [get]
func (h *FileManagementHandler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "DownloadFile")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// TODO: Implement actual file download
	// This would involve:
	// 1. Checking access permissions
	// 2. Retrieving file from storage
	// 3. Decrypting content if needed
	// 4. Streaming content to client

	// For now, return a placeholder response
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", "example.pdf"))
	w.WriteHeader(http.StatusOK)
}

// GetFileMetadata gets file metadata
// @Summary Get file metadata
// @Description Gets detailed metadata for a file
// @Tags files
// @Produce json
// @Param fileId path string true "File ID"
// @Success 200 {object} MetadataResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId}/metadata [get]
func (h *FileManagementHandler) GetFileMetadata(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "GetFileMetadata")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	_, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	// TODO: Implement actual metadata retrieval
	// This would involve querying the document's metadata from the database

	metadata := MetadataResponse{
		EXIF: map[string]interface{}{
			"camera": "Canon EOS 5D",
		},
		Document: map[string]interface{}{
			"title":   "Example Document",
			"author":  "John Doe",
			"subject": "Test Document",
		},
		Content: map[string]interface{}{
			"word_count":      1500,
			"character_count": 7500,
			"page_count":      5,
		},
		Analysis: map[string]interface{}{
			"language":    "en",
			"readability": 75.5,
			"sentiment":   "neutral",
			"keywords":    []string{"example", "test", "document"},
		},
	}

	h.writeJSONResponse(w, http.StatusOK, metadata)
}

// GrantFileAccess grants access to a file
// @Summary Grant file access
// @Description Grants access permissions to a user for a file
// @Tags files
// @Accept json
// @Produce json
// @Param fileId path string true "File ID"
// @Param request body storage.GrantAccessRequest true "Grant access request"
// @Success 200 {object} AccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId}/access/grant [post]
func (h *FileManagementHandler) GrantFileAccess(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "GrantFileAccess")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	var req storage.GrantAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	req.DocumentID = fileID

	if err := h.accessControl.GrantAccess(ctx, &req); err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to grant access", err)
		return
	}

	response := AccessResponse{
		Message:   "Access granted successfully",
		UserID:    req.UserID,
		Role:      req.Role,
		GrantedAt: time.Now(),
	}

	h.writeJSONResponse(w, http.StatusOK, response)
}

// RevokeFileAccess revokes access to a file
// @Summary Revoke file access
// @Description Revokes access permissions from a user for a file
// @Tags files
// @Accept json
// @Produce json
// @Param fileId path string true "File ID"
// @Param request body storage.RevokeAccessRequest true "Revoke access request"
// @Success 200 {object} AccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 401 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId}/access/revoke [post]
func (h *FileManagementHandler) RevokeFileAccess(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "RevokeFileAccess")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	var req storage.RevokeAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	req.DocumentID = fileID

	if err := h.accessControl.RevokeAccess(ctx, &req); err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to revoke access", err)
		return
	}

	response := AccessResponse{
		Message:   "Access revoked successfully",
		UserID:    req.UserID,
		RevokedAt: time.Now(),
	}

	h.writeJSONResponse(w, http.StatusOK, response)
}

// ListFileAccess lists access permissions for a file
// @Summary List file access
// @Description Lists all access permissions for a file
// @Tags files
// @Produce json
// @Param fileId path string true "File ID"
// @Success 200 {array} storage.AccessEntry
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/v1/files/{fileId}/access [get]
func (h *FileManagementHandler) ListFileAccess(w http.ResponseWriter, r *http.Request) {
	ctx, span := h.tracer.Start(r.Context(), "ListFileAccess")
	defer span.End()

	vars := mux.Vars(r)
	fileIDStr := vars["fileId"]
	_, err := uuid.Parse(fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	tenantID := r.URL.Query().Get("tenantId")
	entries, err := h.accessControl.ListAccess(ctx, tenantID, fileIDStr)
	if err != nil {
		h.writeErrorResponse(w, http.StatusInternalServerError, "Failed to list access", err)
		return
	}

	h.writeJSONResponse(w, http.StatusOK, entries)
}

// Helper methods

func (h *FileManagementHandler) validateInitiateUploadRequest(req *services.InitiateUploadRequest) error {
	if req.TenantID == uuid.Nil {
		return fmt.Errorf("tenant ID is required")
	}
	if req.UserID == uuid.Nil {
		return fmt.Errorf("user ID is required")
	}
	if req.OriginalName == "" {
		return fmt.Errorf("original filename is required")
	}
	if req.FileSize <= 0 {
		return fmt.Errorf("file size must be positive")
	}
	return nil
}

func (h *FileManagementHandler) writeJSONResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *FileManagementHandler) writeErrorResponse(w http.ResponseWriter, status int, message string, err error) {
	response := ErrorResponse{
		Error:   message,
		Details: "",
	}
	if err != nil {
		response.Details = err.Error()
		h.logger.WithError(err).Error(message)
	}
	h.writeJSONResponse(w, status, response)
}

// Utility functions

func parseIntQueryParam(r *http.Request, key string, defaultValue int) int {
	value := r.URL.Query().Get(key)
	if value == "" {
		return defaultValue
	}
	if intValue, err := strconv.Atoi(value); err == nil {
		return intValue
	}
	return defaultValue
}

func parseCommaSeparatedParam(r *http.Request, key string) []string {
	value := r.URL.Query().Get(key)
	if value == "" {
		return nil
	}
	return strings.Split(value, ",")
}

// Response types

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

type FileInfo struct {
	ID               uuid.UUID `json:"id"`
	Filename         string    `json:"filename"`
	OriginalFilename string    `json:"original_filename"`
	ContentType      string    `json:"content_type"`
	FileSize         int64     `json:"file_size"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	Tags             []string  `json:"tags"`
}

type FileListResponse struct {
	Files  []FileInfo `json:"files"`
	Total  int        `json:"total"`
	Limit  int        `json:"limit"`
	Offset int        `json:"offset"`
}

type FileDetailsResponse struct {
	ID               uuid.UUID              `json:"id"`
	Filename         string                 `json:"filename"`
	OriginalFilename string                 `json:"original_filename"`
	ContentType      string                 `json:"content_type"`
	FileSize         int64                  `json:"file_size"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
	Tags             []string               `json:"tags"`
	Metadata         map[string]interface{} `json:"metadata"`
}

type UpdateFileRequest struct {
	Filename string                 `json:"filename,omitempty"`
	Tags     []string               `json:"tags,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type MetadataResponse struct {
	EXIF     map[string]interface{} `json:"exif,omitempty"`
	Document map[string]interface{} `json:"document,omitempty"`
	Content  map[string]interface{} `json:"content,omitempty"`
	Analysis map[string]interface{} `json:"analysis,omitempty"`
}

type AccessResponse struct {
	Message   string    `json:"message"`
	UserID    uuid.UUID `json:"user_id"`
	Role      string    `json:"role,omitempty"`
	GrantedAt time.Time `json:"granted_at,omitempty"`
	RevokedAt time.Time `json:"revoked_at,omitempty"`
}
