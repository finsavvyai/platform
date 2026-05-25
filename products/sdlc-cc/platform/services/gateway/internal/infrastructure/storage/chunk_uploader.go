package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/types"
)

// ChunkUploader handles the actual upload of individual chunks
type ChunkUploader struct {
	session           *types.UploadSession
	config            *types.MultiPartUploadConfig
	storageProvider   StorageProvider
	encryptionService EncryptionService
	logger            *logrus.Logger
	chunkStorage      map[int][]byte // Temporary storage for chunks
	tempStoragePath   string
}

// NewChunkUploader creates a new chunk uploader
func NewChunkUploader(
	session *types.UploadSession,
	config *types.MultiPartUploadConfig,
	storageProvider StorageProvider,
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
func (cu *ChunkUploader) UploadChunk(ctx context.Context, req *types.UploadChunkRequest) (*types.ChunkInfo, error) {
	ctx, span := otel.Tracer("chunk-uploader").Start(ctx, "UploadChunk")
	defer span.End()

	startTime := time.Now()

	// Verify chunk checksum
	if err := cu.verifyChunkChecksum(req.Content, req.Checksum); err != nil {
		return nil, fmt.Errorf("chunk checksum verification failed: %w", err)
	}

	// Encrypt chunk content
	encryptedContent, err := cu.encryptChunk(ctx, req.Content)
	if err != nil {
		return nil, fmt.Errorf("chunk encryption failed: %w", err)
	}

	// Generate chunk filename
	chunkFilename := cu.generateChunkFilename(req.ChunkIndex)

	// Store chunk
	storagePath, err := cu.storageProvider.Store(ctx, StoreRequest{
		TenantID:    cu.session.TenantID,
		DocumentID:  cu.session.ID, // Use session ID for temporary storage
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

	chunkInfo := &types.ChunkInfo{
		Index:      req.ChunkIndex,
		Size:       req.Size,
		Checksum:   req.Checksum,
		Uploaded:   true,
		UploadTime: &startTime,
		Retries:    0, // This would be tracked by the calling service
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

	cu.logger.WithFields(logrus.Fields{
		"session_id":   cu.session.ID,
		"total_chunks": cu.session.TotalChunks,
	}).Info("Starting to combine chunks")

	// Create buffer for combined content
	var combinedContent []byte
	totalSize := int64(0)

	// Combine chunks in order
	for chunkIndex := 0; chunkIndex < cu.session.TotalChunks; chunkIndex++ {
		if !cu.session.UploadedChunks[chunkIndex] {
			return nil, fmt.Errorf("chunk %d not uploaded", chunkIndex)
		}

		// Retrieve chunk from storage
		chunkFilename := cu.generateChunkFilename(chunkIndex)
		chunkContent, err := cu.storageProvider.Retrieve(
			ctx,
			cu.session.TenantID.String(),
			cu.session.ID.String(),
			chunkFilename,
		)

		if err != nil {
			return nil, fmt.Errorf("failed to retrieve chunk %d: %w", chunkIndex, err)
		}

		// Decrypt chunk content
		decryptedContent, err := cu.decryptChunk(ctx, chunkContent)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt chunk %d: %w", chunkIndex, err)
		}

		// Append to combined content
		combinedContent = append(combinedContent, decryptedContent...)
		totalSize += int64(len(decryptedContent))

		cu.logger.WithFields(logrus.Fields{
			"session_id":  cu.session.ID,
			"chunk_index": chunkIndex,
			"chunk_size":  len(decryptedContent),
			"total_size":  totalSize,
		}).Debug("Chunk combined")
	}

	// Verify final file size matches expected
	if totalSize != cu.session.FileSize {
		return nil, fmt.Errorf("combined file size %d doesn't match expected size %d", totalSize, cu.session.FileSize)
	}

	// Verify final checksum
	if err := cu.verifyFinalChecksum(combinedContent, cu.session.Checksum); err != nil {
		return nil, fmt.Errorf("final checksum verification failed: %w", err)
	}

	cu.logger.WithFields(logrus.Fields{
		"session_id": cu.session.ID,
		"final_size": totalSize,
	}).Info("Chunks combined successfully")

	return combinedContent, nil
}

// CleanupChunks removes temporary chunk files
func (cu *ChunkUploader) CleanupChunks(ctx context.Context) error {
	cu.logger.WithField("session_id", cu.session.ID).Info("Cleaning up temporary chunks")

	// Delete all chunk files
	for chunkIndex := 0; chunkIndex < cu.session.TotalChunks; chunkIndex++ {
		chunkFilename := cu.generateChunkFilename(chunkIndex)

		err := cu.storageProvider.Delete(
			ctx,
			cu.session.TenantID.String(),
			cu.session.ID.String(),
			chunkFilename,
		)

		if err != nil {
			cu.logger.WithFields(logrus.Fields{
				"session_id":  cu.session.ID,
				"chunk_index": chunkIndex,
				"error":       err,
			}).Warn("Failed to delete temporary chunk")
		}
	}

	return nil
}

// verifyChunkChecksum verifies the checksum of a chunk
func (cu *ChunkUploader) verifyChunkChecksum(content []byte, expectedChecksum string) error {
	hash := sha256.Sum256(content)
	actualChecksum := fmt.Sprintf("%x", hash)

	if actualChecksum != expectedChecksum {
		return fmt.Errorf("chunk checksum mismatch: expected %s, got %s", expectedChecksum, actualChecksum)
	}

	return nil
}

// verifyFinalChecksum verifies the checksum of the combined file
func (cu *ChunkUploader) verifyFinalChecksum(content []byte, expectedChecksum string) error {
	hash := sha256.Sum256(content)
	actualChecksum := fmt.Sprintf("%x", hash)

	if actualChecksum != expectedChecksum {
		return fmt.Errorf("final checksum mismatch: expected %s, got %s", expectedChecksum, actualChecksum)
	}

	return nil
}

// encryptChunk encrypts a chunk
func (cu *ChunkUploader) encryptChunk(ctx context.Context, content []byte) ([]byte, error) {
	if cu.encryptionService != nil {
		encrypted, _, err := cu.encryptionService.EncryptForTenant(
			ctx,
			cu.session.TenantID.String(),
			content,
		)
		return encrypted, err
	}
	return content, nil
}

// decryptChunk decrypts a chunk
func (cu *ChunkUploader) decryptChunk(ctx context.Context, encryptedContent []byte) ([]byte, error) {
	if cu.encryptionService != nil {
		decrypted, err := cu.encryptionService.DecryptForTenant(
			ctx,
			cu.session.TenantID.String(),
			encryptedContent,
		)
		return decrypted, err
	}
	return encryptedContent, nil
}

// generateChunkFilename generates a unique filename for a chunk
func (cu *ChunkUploader) generateChunkFilename(chunkIndex int) string {
	return fmt.Sprintf("chunk_%05d.dat", chunkIndex)
}

// GetChunkInfo returns information about all chunks
func (cu *ChunkUploader) GetChunkInfo() []types.ChunkInfo {
	var chunks []types.ChunkInfo

	for chunkIndex := 0; chunkIndex < cu.session.TotalChunks; chunkIndex++ {
		chunkInfo := types.ChunkInfo{
			Index:    chunkIndex,
			Size:     cu.calculateChunkSize(chunkIndex),
			Uploaded: cu.session.UploadedChunks[chunkIndex],
		}

		if chunkIndex == 0 {
			chunkInfo.Size = cu.session.FileSize
			if cu.session.TotalChunks > 1 {
				chunkInfo.Size = cu.session.ChunkSize
			}
		}

		chunks = append(chunks, chunkInfo)
	}

	return chunks
}

// calculateChunkSize calculates the size of a specific chunk
func (cu *ChunkUploader) calculateChunkSize(chunkIndex int) int64 {
	if chunkIndex >= cu.session.TotalChunks-1 {
		// Last chunk might be smaller
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
		"session_id":      cu.session.ID.String(),
		"total_chunks":    cu.session.TotalChunks,
		"uploaded_chunks": uploadedChunks,
		"progress":        progress,
		"bytes_uploaded":  cu.session.BytesUploaded,
		"total_bytes":     cu.session.FileSize,
		"status":          string(cu.session.Status),
	}
}
