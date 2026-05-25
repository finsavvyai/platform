package services

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
)

// ChunkUploader handles the actual upload of individual chunks
type ChunkUploader struct {
	session           *UploadSession
	config            *MultiPartUploadConfig
	storageProvider   storage.StorageProvider
	encryptionService storage.EncryptionService
	logger            *logrus.Logger
	chunkStorage      map[int][]byte
	tempStoragePath   string
}

// NewChunkUploader creates a new chunk uploader
func NewChunkUploader(
	session *UploadSession,
	config *MultiPartUploadConfig,
	storageProvider storage.StorageProvider,
	logger *logrus.Logger,
) *ChunkUploader {
	tempStoragePath := fmt.Sprintf("%s/chunks/%s", config.TempDir, session.ID.String())

	return &ChunkUploader{
		session:         session,
		config:          config,
		storageProvider: storageProvider,
		logger:          logger,
		chunkStorage:    make(map[int][]byte),
		tempStoragePath: tempStoragePath,
	}
}

// UploadChunk uploads a single chunk to storage
func (cu *ChunkUploader) UploadChunk(ctx context.Context, req *UploadChunkRequest) (*ChunkInfo, error) {
	ctx, span := otel.Tracer("chunk-uploader").Start(ctx, "UploadChunk")
	defer span.End()

	startTime := time.Now()

	if err := cu.verifyChunkChecksum(req.Content, req.Checksum); err != nil {
		return nil, fmt.Errorf("chunk checksum verification failed: %w", err)
	}

	encryptedContent, err := cu.encryptChunk(ctx, req.Content)
	if err != nil {
		return nil, fmt.Errorf("chunk encryption failed: %w", err)
	}

	chunkFilename := cu.generateChunkFilename(req.ChunkIndex)

	storagePath, err := cu.storageProvider.Store(ctx, storage.StoreRequest{
		TenantID:    cu.session.TenantID,
		DocumentID:  cu.session.ID,
		Filename:    chunkFilename,
		Content:     encryptedContent,
		ContentType: "application/octet-stream",
		Metadata: map[string]interface{}{
			"chunk_index":      req.ChunkIndex,
			"chunk_size":       req.Size,
			"chunk_checksum":   req.Checksum,
			"session_id":       cu.session.ID.String(),
			"original_name":    cu.session.OriginalName,
			"upload_timestamp": time.Now().UTC().Format(time.RFC3339),
		},
		Tags: []string{
			fmt.Sprintf("chunk:%d", req.ChunkIndex),
			"upload-session",
			"temporary",
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to store chunk: %w", err)
	}

	uploadTime := time.Since(startTime)

	chunkInfo := &ChunkInfo{
		Index:      req.ChunkIndex,
		Size:       req.Size,
		Checksum:   req.Checksum,
		Uploaded:   true,
		UploadTime: &startTime,
		Retries:    0,
	}

	cu.logger.WithFields(logrus.Fields{
		"session_id":   req.SessionID,
		"chunk_index":  req.ChunkIndex,
		"chunk_size":   req.Size,
		"storage_path": storagePath,
		"upload_time":  uploadTime,
	}).Debug("Chunk uploaded successfully")

	return chunkInfo, nil
}

// CombineChunks combines all uploaded chunks into a single file
func (cu *ChunkUploader) CombineChunks(ctx context.Context) ([]byte, error) {
	ctx, span := otel.Tracer("chunk-uploader").Start(ctx, "CombineChunks")
	defer span.End()

	var combinedContent []byte
	totalSize := int64(0)

	for chunkIndex := 0; chunkIndex < cu.session.TotalChunks; chunkIndex++ {
		if !cu.session.UploadedChunks[chunkIndex] {
			return nil, fmt.Errorf("chunk %d not uploaded", chunkIndex)
		}

		chunkFilename := cu.generateChunkFilename(chunkIndex)
		chunkContent, err := cu.storageProvider.Retrieve(
			ctx, cu.session.TenantID.String(),
			cu.session.ID.String(), chunkFilename,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve chunk %d: %w", chunkIndex, err)
		}

		decryptedContent, err := cu.decryptChunk(ctx, chunkContent)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt chunk %d: %w", chunkIndex, err)
		}

		combinedContent = append(combinedContent, decryptedContent...)
		totalSize += int64(len(decryptedContent))
	}

	if totalSize != cu.session.FileSize {
		return nil, fmt.Errorf("combined size %d doesn't match expected %d", totalSize, cu.session.FileSize)
	}

	if err := cu.verifyFinalChecksum(combinedContent, cu.session.Checksum); err != nil {
		return nil, fmt.Errorf("final checksum verification failed: %w", err)
	}

	return combinedContent, nil
}

// CleanupChunks removes temporary chunk files
func (cu *ChunkUploader) CleanupChunks(ctx context.Context) error {
	for chunkIndex := 0; chunkIndex < cu.session.TotalChunks; chunkIndex++ {
		chunkFilename := cu.generateChunkFilename(chunkIndex)
		if err := cu.storageProvider.Delete(
			ctx, cu.session.TenantID.String(),
			cu.session.ID.String(), chunkFilename,
		); err != nil {
			cu.logger.WithFields(logrus.Fields{
				"session_id": cu.session.ID, "chunk_index": chunkIndex, "error": err,
			}).Warn("Failed to delete temporary chunk")
		}
	}
	return nil
}

func (cu *ChunkUploader) verifyChunkChecksum(content []byte, expected string) error {
	hash := sha256.Sum256(content)
	actual := fmt.Sprintf("%x", hash)
	if actual != expected {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expected, actual)
	}
	return nil
}

func (cu *ChunkUploader) verifyFinalChecksum(content []byte, expected string) error {
	return cu.verifyChunkChecksum(content, expected)
}

func (cu *ChunkUploader) encryptChunk(ctx context.Context, content []byte) ([]byte, error) {
	if cu.encryptionService != nil {
		encrypted, _, err := cu.encryptionService.EncryptForTenant(ctx, cu.session.TenantID.String(), content)
		return encrypted, err
	}
	return content, nil
}

func (cu *ChunkUploader) decryptChunk(ctx context.Context, encrypted []byte) ([]byte, error) {
	if cu.encryptionService != nil {
		return cu.encryptionService.DecryptForTenant(ctx, cu.session.TenantID.String(), encrypted)
	}
	return encrypted, nil
}

func (cu *ChunkUploader) generateChunkFilename(chunkIndex int) string {
	return fmt.Sprintf("chunk_%05d.dat", chunkIndex)
}

// GetChunkInfo returns information about all chunks
func (cu *ChunkUploader) GetChunkInfo() []ChunkInfo {
	var chunks []ChunkInfo
	for i := 0; i < cu.session.TotalChunks; i++ {
		info := ChunkInfo{Index: i, Size: cu.calculateChunkSize(i), Uploaded: cu.session.UploadedChunks[i]}
		if i == 0 {
			info.Size = cu.session.FileSize
			if cu.session.TotalChunks > 1 {
				info.Size = cu.session.ChunkSize
			}
		}
		chunks = append(chunks, info)
	}
	return chunks
}

func (cu *ChunkUploader) calculateChunkSize(chunkIndex int) int64 {
	if chunkIndex >= cu.session.TotalChunks-1 {
		remaining := cu.session.FileSize - int64(chunkIndex)*cu.session.ChunkSize
		if remaining < cu.session.ChunkSize {
			return remaining
		}
	}
	return cu.session.ChunkSize
}

// GetUploadStats returns upload statistics
func (cu *ChunkUploader) GetUploadStats() map[string]interface{} {
	uploadedChunks := len(cu.session.UploadedChunks)
	progress := float64(uploadedChunks) / float64(cu.session.TotalChunks) * 100
	return map[string]interface{}{
		"session_id": cu.session.ID.String(), "total_chunks": cu.session.TotalChunks,
		"uploaded_chunks": uploadedChunks, "progress": progress,
		"bytes_uploaded": cu.session.BytesUploaded, "total_bytes": cu.session.FileSize,
		"status": string(cu.session.Status),
	}
}
