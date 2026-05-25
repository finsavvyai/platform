//go:build ignore

package services

import (
	"github.com/sirupsen/logrus"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/types"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/storage"
)

// ChunkUploader handles the actual upload of individual chunks
type ChunkUploader struct {
	session         *types.UploadSession
	config          *types.MultiPartUploadConfig
	storageProvider storage.StorageProvider
	logger          *logrus.Logger
	chunkStorage    map[int][]byte
	tempStoragePath string
}

// NewChunkUploader creates a new chunk uploader
func NewChunkUploader(
	session *types.UploadSession,
	config *types.MultiPartUploadConfig,
	storageProvider storage.StorageProvider,
	logger *logrus.Logger,
) *ChunkUploader {
	return &ChunkUploader{
		session:         session,
		config:          config,
		storageProvider: storageProvider,
		logger:          logger,
		chunkStorage:    make(map[int][]byte),
	}
}
