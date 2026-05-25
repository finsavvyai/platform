//go:build ignore

package services

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/types"
)

// Type aliases for backwards compatibility
type MultiPartUploadConfig = types.MultiPartUploadConfig
type UploadSession = types.UploadSession
type UploadSessionStatus = types.UploadSessionStatus
type ChunkInfo = types.ChunkInfo
type UploadProgress = types.UploadProgress
type UploadChunkRequest = types.UploadChunkRequest

// Re-export constants
const (
	UploadSessionStatusInitiated = types.UploadSessionStatusInitiated
	UploadSessionStatusUploading = types.UploadSessionStatusUploading
	UploadSessionStatusPaused    = types.UploadSessionStatusPaused
	UploadSessionStatusCompleted = types.UploadSessionStatusCompleted
	UploadSessionStatusFailed    = types.UploadSessionStatusFailed
	UploadSessionStatusExpired   = types.UploadSessionStatusExpired
	UploadSessionStatusAbandoned = types.UploadSessionStatusAbandoned
)

// Re-export default config function
func DefaultMultiPartUploadConfig() *MultiPartUploadConfig {
	return types.DefaultMultiPartUploadConfig()
}

// ChunkUploader handles individual chunk uploads
type ChunkUploader interface {
	UploadChunk(ctx context.Context, req *UploadChunkRequest) (*ChunkInfo, error)
}

// StorageProvider defines the interface for storage operations
type StorageProvider interface {
	StoreChunk(ctx context.Context, sessionID uuid.UUID, chunkIndex int, data []byte) error
	GetChunk(ctx context.Context, sessionID uuid.UUID, chunkIndex int) ([]byte, error)
	CompleteUpload(ctx context.Context, sessionID uuid.UUID) (string, error)
	AbortUpload(ctx context.Context, sessionID uuid.UUID) error
}

// EncryptionService defines the interface for encryption operations
type EncryptionService interface {
	EncryptForTenant(ctx context.Context, tenantID string, data []byte) ([]byte, string, error)
}

// VirusScanner defines the interface for virus scanning
type VirusScanner interface {
	Scan(ctx context.Context, content []byte) (*VirusScanResult, error)
}

// MetadataExtractor defines the interface for metadata extraction
type MetadataExtractor interface {
	Extract(ctx context.Context, content []byte, contentType string) (map[string]interface{}, error)
}

// MultiPartUploadService handles multipart file uploads with progress tracking
type MultiPartUploadService struct {
	config               *MultiPartUploadConfig
	storageProvider      StorageProvider
	encryptionService    EncryptionService
	virusScanner         VirusScanner
	metadataExtractor    MetadataExtractor
	logger               *logrus.Logger
	tracer               trace.Tracer
	sessions             map[uuid.UUID]*UploadSession
	sessionsMutex        sync.RWMutex
	chunkUploaders       map[uuid.UUID]ChunkUploader
	chunkUploadersMux    sync.RWMutex
	progressCallbacks    map[uuid.UUID][]func(*UploadProgress)
	progressCallbacksMux sync.RWMutex
	cleanupTicker        *time.Ticker
}

// NewMultiPartUploadService creates a new multipart upload service
func NewMultiPartUploadService(
	config *MultiPartUploadConfig,
	storageProvider StorageProvider,
	encryptionService EncryptionService,
	virusScanner VirusScanner,
	metadataExtractor MetadataExtractor,
	logger *logrus.Logger,
) *MultiPartUploadService {
	if config == nil {
		config = DefaultMultiPartUploadConfig()
	}

	service := &MultiPartUploadService{
		config:            config,
		storageProvider:   storageProvider,
		encryptionService: encryptionService,
		virusScanner:      virusScanner,
		metadataExtractor: metadataExtractor,
		logger:            logger,
		tracer:            otel.Tracer("multipart-upload-service"),
		sessions:          make(map[uuid.UUID]*UploadSession),
		chunkUploaders:    make(map[uuid.UUID]ChunkUploader),
		progressCallbacks: make(map[uuid.UUID][]func(*UploadProgress)),
	}

	// Start cleanup routine
	service.cleanupTicker = time.NewTicker(config.CleanupInterval)
	go service.cleanupRoutine()

	return service
}

// InitiateUpload initiates a new multipart upload session
func (s *MultiPartUploadService) InitiateUpload(ctx context.Context, req *InitiateUploadRequest) (*UploadSession, error) {
	ctx, span := s.tracer.Start(ctx, "InitiateUpload")
	defer span.End()

	sessionID := uuid.New()

	// Validate file size
	if req.FileSize > s.config.MaxFileSize {
		return nil, fmt.Errorf("file size %d exceeds maximum allowed size %d", req.FileSize, s.config.MaxFileSize)
	}

	// Calculate chunk information
	chunkSize := s.config.ChunkSize
	if req.ChunkSize > 0 {
		chunkSize = req.ChunkSize
	}

	totalChunks := int(math.Ceil(float64(req.FileSize) / float64(chunkSize)))
	if totalChunks == 0 {
		totalChunks = 1
	}

	// Generate encryption key ID for this upload
	encryptionKeyID := fmt.Sprintf("upload-%s", sessionID.String())

	// Create upload session
	session := &UploadSession{
		ID:              sessionID,
		TenantID:        req.TenantID,
		UserID:          req.UserID,
		OriginalName:    req.OriginalName,
		ContentType:     req.ContentType,
		FileSize:        req.FileSize,
		Checksum:        req.Checksum,
		TotalChunks:     totalChunks,
		UploadedChunks:  make(map[int]bool),
		ChunkSize:       chunkSize,
		EncryptionKeyID: encryptionKeyID,
		Metadata:        req.Metadata,
		Status:          UploadSessionStatusInitiated,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		ExpiresAt:       time.Now().Add(s.config.UploadTimeout),
		LastActivity:    time.Now(),
	}

	// Store session
	s.sessionsMutex.Lock()
	s.sessions[sessionID] = session
	s.sessionsMutex.Unlock()

	s.logger.WithFields(logrus.Fields{
		"session_id":    sessionID,
		"tenant_id":     req.TenantID,
		"user_id":       req.UserID,
		"original_name": req.OriginalName,
		"file_size":     req.FileSize,
		"total_chunks":  totalChunks,
		"chunk_size":    chunkSize,
	}).Info("Upload session initiated")

	// Notify progress callback
	s.notifyProgress(sessionID, s.calculateProgress(session))

	return session, nil
}

// UploadChunk uploads a single chunk
func (s *MultiPartUploadService) UploadChunk(ctx context.Context, req *UploadChunkRequest) (*ChunkInfo, error) {
	ctx, span := s.tracer.Start(ctx, "UploadChunk")
	defer span.End()

	// Get session
	s.sessionsMutex.RLock()
	session, exists := s.sessions[req.SessionID]
	s.sessionsMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("upload session not found: %s", req.SessionID)
	}

	// Validate session status
	if session.Status != UploadSessionStatusUploading && session.Status != UploadSessionStatusInitiated {
		return nil, fmt.Errorf("upload session is not in uploading state: %s", session.Status)
	}

	// Validate chunk index
	if req.ChunkIndex < 0 || req.ChunkIndex >= session.TotalChunks {
		return nil, fmt.Errorf("invalid chunk index: %d (total: %d)", req.ChunkIndex, session.TotalChunks)
	}

	// Check if chunk already uploaded
	if session.UploadedChunks[req.ChunkIndex] {
		return &ChunkInfo{
			Index:    req.ChunkIndex,
			Size:     req.Size,
			Checksum: req.Checksum,
			Uploaded: true,
		}, nil
	}

	// Validate chunk size
	expectedSize := s.calculateChunkSize(session.FileSize, session.ChunkSize, req.ChunkIndex)
	if req.Size != expectedSize {
		return nil, fmt.Errorf("invalid chunk size: %d (expected: %d)", req.Size, expectedSize)
	}

	// Create chunk uploader if not exists
	s.chunkUploadersMux.Lock()
	uploader, exists := s.chunkUploaders[req.SessionID]
	if !exists {
		uploader = NewDefaultChunkUploader(session, s.config, s.storageProvider, s.logger)
		s.chunkUploaders[req.SessionID] = uploader
	}
	s.chunkUploadersMux.Unlock()

	// Upload chunk with retry logic
	chunkInfo, err := s.uploadChunkWithRetry(ctx, uploader, req)
	if err != nil {
		s.logger.WithFields(logrus.Fields{
			"session_id":  req.SessionID,
			"chunk_index": req.ChunkIndex,
			"error":       err,
		}).Error("Failed to upload chunk")
		return nil, err
	}

	// Update session
	s.sessionsMutex.Lock()
	session.UploadedChunks[req.ChunkIndex] = true
	session.UpdatedAt = time.Now()
	session.LastActivity = time.Now()
	session.BytesUploaded += req.Size
	session.Progress = s.calculateProgress(session)
	s.sessionsMutex.Unlock()

	// Update status to uploading if this was the first chunk
	if len(session.UploadedChunks) == 1 {
		session.Status = UploadSessionStatusUploading
	}

	// Notify progress callback
	s.notifyProgress(req.SessionID, s.calculateProgress(session))

	s.logger.WithFields(logrus.Fields{
		"session_id":  req.SessionID,
		"chunk_index": req.ChunkIndex,
		"size":        req.Size,
		"uploaded":    len(session.UploadedChunks),
		"total":       session.TotalChunks,
	}).Debug("Chunk uploaded successfully")

	return chunkInfo, nil
}

// CompleteUpload completes a multipart upload
func (s *MultiPartUploadService) CompleteUpload(ctx context.Context, sessionID uuid.UUID) (*UploadResponse, error) {
	ctx, span := s.tracer.Start(ctx, "CompleteUpload")
	defer span.End()

	// Get session
	s.sessionsMutex.RLock()
	session, exists := s.sessions[sessionID]
	s.sessionsMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("upload session not found: %s", sessionID)
	}

	// Check if all chunks are uploaded
	uploadedChunks := len(session.UploadedChunks)
	if uploadedChunks != session.TotalChunks {
		return nil, fmt.Errorf("not all chunks uploaded: %d/%d", uploadedChunks, session.TotalChunks)
	}

	// Update session status
	session.Status = UploadSessionStatusCompleted
	session.UpdatedAt = time.Now()
	session.UploadDuration = time.Since(session.CreatedAt)

	s.logger.WithFields(logrus.Fields{
		"session_id":      sessionID,
		"tenant_id":       session.TenantID,
		"user_id":         session.UserID,
		"original_name":   session.OriginalName,
		"file_size":       session.FileSize,
		"upload_duration": session.UploadDuration,
		"chunks_uploaded": uploadedChunks,
	}).Info("Upload completed")

	// Finalize with storage provider
	var storagePath string
	if s.storageProvider != nil {
		path, err := s.storageProvider.CompleteUpload(ctx, sessionID)
		if err != nil {
			s.logger.WithError(err).Error("Failed to complete upload with storage provider")
			return nil, fmt.Errorf("failed to complete upload: %w", err)
		}
		storagePath = path
	}

	// Create final upload response
	response := &UploadResponse{
		DocumentID:     uuid.New(), // Will be created by the main upload service
		Filename:       session.OriginalName,
		ContentType:    session.ContentType,
		FileSize:       session.FileSize,
		Checksum:       session.Checksum,
		Metadata:       session.Metadata,
		Status:         "completed",
		UploadedAt:     time.Now(),
		ProcessingTime: session.UploadDuration,
		UploadSession: &UploadSessionInfo{
			SessionID:   session.ID,
			TotalChunks: session.TotalChunks,
			UploadSpeed: float64(session.FileSize) / session.UploadDuration.Seconds(),
			ResumeCount: 0,
		},
		StoragePath: storagePath,
	}

	// Clean up resources
	s.cleanupSession(sessionID)

	return response, nil
}

// GetUploadProgress returns upload progress
func (s *MultiPartUploadService) GetUploadProgress(ctx context.Context, sessionID uuid.UUID) (*UploadProgress, error) {
	s.sessionsMutex.RLock()
	session, exists := s.sessions[sessionID]
	s.sessionsMutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("upload session not found: %s", sessionID)
	}

	progress := s.calculateProgress(session)

	// Calculate upload speed and ETA
	if session.Status == UploadSessionStatusUploading && len(session.UploadedChunks) > 0 {
		timeSinceStart := time.Since(session.CreatedAt).Seconds()
		if timeSinceStart > 0 {
			progress.Speed = float64(session.BytesUploaded) / timeSinceStart

			if progress.Speed > 0 {
				remainingBytes := session.FileSize - session.BytesUploaded
				etaSeconds := int(remainingBytes / progress.Speed)
				progress.ETA = &etaSeconds
			}
		}
	}

	return progress, nil
}

// PauseUpload pauses an upload session
func (s *MultiPartUploadService) PauseUpload(ctx context.Context, sessionID uuid.UUID) error {
	s.sessionsMutex.Lock()
	defer s.sessionsMutex.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return fmt.Errorf("upload session not found: %s", sessionID)
	}

	if session.Status == UploadSessionStatusUploading {
		session.Status = UploadSessionStatusPaused
		session.UpdatedAt = time.Now()

		s.logger.WithField("session_id", sessionID).Info("Upload paused")
	}

	return nil
}

// ResumeUpload resumes a paused upload session
func (s *MultiPartUploadService) ResumeUpload(ctx context.Context, sessionID uuid.UUID) error {
	s.sessionsMutex.Lock()
	defer s.sessionsMutex.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return fmt.Errorf("upload session not found: %s", sessionID)
	}

	if session.Status == UploadSessionStatusPaused {
		session.Status = UploadSessionStatusUploading
		session.UpdatedAt = time.Now()
		session.LastActivity = time.Now()

		s.logger.WithField("session_id", sessionID).Info("Upload resumed")
	}

	return nil
}

// CancelUpload cancels an upload session
func (s *MultiPartUploadService) CancelUpload(ctx context.Context, sessionID uuid.UUID) error {
	s.sessionsMutex.Lock()
	defer s.sessionsMutex.Unlock()

	session, exists := s.sessions[sessionID]
	if !exists {
		return fmt.Errorf("upload session not found: %s", sessionID)
	}

	session.Status = UploadSessionStatusFailed
	session.Error = "Upload cancelled by user"
	session.UpdatedAt = time.Now()

	// Abort with storage provider
	if s.storageProvider != nil {
		if err := s.storageProvider.AbortUpload(ctx, sessionID); err != nil {
			s.logger.WithError(err).Warn("Failed to abort upload with storage provider")
		}
	}

	// Clean up resources
	s.cleanupSession(sessionID)

	s.logger.WithField("session_id", sessionID).Info("Upload cancelled")

	return nil
}

// ListUploadSessions lists active upload sessions for a tenant
func (s *MultiPartUploadService) ListUploadSessions(ctx context.Context, tenantID uuid.UUID) ([]*UploadSession, error) {
	s.sessionsMutex.RLock()
	defer s.sessionsMutex.RUnlock()

	var sessions []*UploadSession
	for _, session := range s.sessions {
		if session.TenantID == tenantID {
			sessions = append(sessions, session)
		}
	}

	return sessions, nil
}

// RegisterProgressCallback registers a callback for upload progress updates
func (s *MultiPartUploadService) RegisterProgressCallback(sessionID uuid.UUID, callback func(*UploadProgress)) {
	s.progressCallbacksMux.Lock()
	defer s.progressCallbacksMux.Unlock()

	if s.progressCallbacks[sessionID] == nil {
		s.progressCallbacks[sessionID] = make([]func(*UploadProgress), 0)
	}
	s.progressCallbacks[sessionID] = append(s.progressCallbacks[sessionID], callback)
}

// UnregisterProgressCallback unregisters a progress callback
func (s *MultiPartUploadService) UnregisterProgressCallback(sessionID uuid.UUID, callback func(*UploadProgress)) {
	s.progressCallbacksMux.Lock()
	defer s.progressCallbacksMux.Unlock()

	callbacks := s.progressCallbacks[sessionID]
	for i, cb := range callbacks {
		if &cb == &callback {
			s.progressCallbacks[sessionID] = append(callbacks[:i], callbacks[i+1:]...)
			break
		}
	}
}

// Helper methods

func (s *MultiPartUploadService) calculateChunkSize(fileSize, chunkSize int64, chunkIndex int) int64 {
	remaining := fileSize - int64(chunkIndex)*chunkSize
	if remaining < chunkSize {
		return remaining
	}
	return chunkSize
}

func (s *MultiPartUploadService) calculateProgress(session *UploadSession) *UploadProgress {
	uploadedChunks := len(session.UploadedChunks)
	progress := float64(uploadedChunks) / float64(session.TotalChunks) * 100

	return &UploadProgress{
		SessionID:      session.ID,
		TotalChunks:    session.TotalChunks,
		UploadedChunks: uploadedChunks,
		BytesUploaded:  session.BytesUploaded,
		TotalBytes:     session.FileSize,
		Progress:       progress,
		Status:         string(session.Status),
		Error:          session.Error,
	}
}

func (s *MultiPartUploadService) uploadChunkWithRetry(ctx context.Context, uploader ChunkUploader, req *UploadChunkRequest) (*ChunkInfo, error) {
	var lastErr error

	for attempt := 0; attempt <= s.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			// Wait before retry
			select {
			case <-time.After(s.config.RetryDelay):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}

		chunkInfo, err := uploader.UploadChunk(ctx, req)
		if err == nil {
			return chunkInfo, nil
		}

		lastErr = err
		s.logger.WithFields(logrus.Fields{
			"session_id":  req.SessionID,
			"chunk_index": req.ChunkIndex,
			"attempt":     attempt + 1,
			"error":       err,
		}).Warn("Chunk upload failed, retrying")
	}

	return nil, fmt.Errorf("chunk upload failed after %d attempts: %w", s.config.RetryAttempts+1, lastErr)
}

func (s *MultiPartUploadService) notifyProgress(sessionID uuid.UUID, progress *UploadProgress) {
	s.progressCallbacksMux.RLock()
	callbacks := s.progressCallbacks[sessionID]
	s.progressCallbacksMux.RUnlock()

	for _, callback := range callbacks {
		go func(cb func(*UploadProgress)) {
			defer func() {
				if r := recover(); r != nil {
					s.logger.WithField("panic", r).Error("Progress callback panicked")
				}
			}()
			cb(progress)
		}(callback)
	}
}

func (s *MultiPartUploadService) cleanupSession(sessionID uuid.UUID) {
	s.sessionsMutex.Lock()
	delete(s.sessions, sessionID)
	s.sessionsMutex.Unlock()

	s.chunkUploadersMux.Lock()
	delete(s.chunkUploaders, sessionID)
	s.chunkUploadersMux.Unlock()

	s.progressCallbacksMux.Lock()
	delete(s.progressCallbacks, sessionID)
	s.progressCallbacksMux.Unlock()
}

func (s *MultiPartUploadService) cleanupRoutine() {
	for range s.cleanupTicker.C {
		s.cleanupExpiredSessions()
	}
}

func (s *MultiPartUploadService) cleanupExpiredSessions() {
	now := time.Now()
	var expiredSessions []uuid.UUID

	s.sessionsMutex.RLock()
	for sessionID, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			expiredSessions = append(expiredSessions, sessionID)
		}
	}
	s.sessionsMutex.RUnlock()

	for _, sessionID := range expiredSessions {
		s.sessionsMutex.Lock()
		if session, exists := s.sessions[sessionID]; exists {
			session.Status = UploadSessionStatusExpired
			session.Error = "Upload session expired"
		}
		s.sessionsMutex.Unlock()

		s.cleanupSession(sessionID)
		s.logger.WithField("session_id", sessionID).Info("Cleaned up expired upload session")
	}
}

// DefaultChunkUploader provides a default implementation of ChunkUploader
type DefaultChunkUploader struct {
	session         *UploadSession
	config          *MultiPartUploadConfig
	storageProvider StorageProvider
	logger          *logrus.Logger
}

// NewDefaultChunkUploader creates a new default chunk uploader
func NewDefaultChunkUploader(
	session *UploadSession,
	config *MultiPartUploadConfig,
	storageProvider StorageProvider,
	logger *logrus.Logger,
) *DefaultChunkUploader {
	return &DefaultChunkUploader{
		session:         session,
		config:          config,
		storageProvider: storageProvider,
		logger:          logger,
	}
}

// UploadChunk implements ChunkUploader
func (u *DefaultChunkUploader) UploadChunk(ctx context.Context, req *UploadChunkRequest) (*ChunkInfo, error) {
	if u.storageProvider == nil {
		// No-op if no storage provider
		return &ChunkInfo{
			Index:    req.ChunkIndex,
			Size:     req.Size,
			Checksum: req.Checksum,
			Uploaded: true,
		}, nil
	}

	err := u.storageProvider.StoreChunk(ctx, req.SessionID, req.ChunkIndex, req.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to store chunk: %w", err)
	}

	return &ChunkInfo{
		Index:    req.ChunkIndex,
		Size:     req.Size,
		Checksum: req.Checksum,
		Uploaded: true,
	}, nil
}

// Request and response types

type InitiateUploadRequest struct {
	TenantID     uuid.UUID              `json:"tenant_id"`
	UserID       uuid.UUID              `json:"user_id"`
	OriginalName string                 `json:"original_name"`
	ContentType  string                 `json:"content_type"`
	FileSize     int64                  `json:"file_size"`
	Checksum     string                 `json:"checksum"`
	ChunkSize    int64                  `json:"chunk_size,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// UploadResponse extends the base UploadResponse with session info
type UploadResponse struct {
	DocumentID     uuid.UUID              `json:"document_id"`
	Filename       string                 `json:"filename"`
	ContentType    string                 `json:"content_type"`
	FileSize       int64                  `json:"file_size"`
	Checksum       string                 `json:"checksum"`
	Metadata       map[string]interface{} `json:"metadata"`
	Status         string                 `json:"status"`
	UploadedAt     time.Time              `json:"uploaded_at"`
	ProcessingTime time.Duration          `json:"processing_time"`
	UploadSession  *UploadSessionInfo     `json:"upload_session,omitempty"`
	StoragePath    string                 `json:"storage_path,omitempty"`
}

type UploadSessionInfo struct {
	SessionID   uuid.UUID `json:"session_id"`
	TotalChunks int       `json:"total_chunks"`
	UploadSpeed float64   `json:"upload_speed"` // bytes per second
	ResumeCount int       `json:"resume_count"`
}
