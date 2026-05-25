package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/database/models"
)

// DocumentRepositoryImpl implements DocumentRepository
type DocumentRepositoryImpl struct {
	BaseRepositoryImpl[models.Document]
}

// NewDocumentRepository creates a new document repository
func NewDocumentRepository(db *gorm.DB) DocumentRepository {
	return &DocumentRepositoryImpl{
		BaseRepositoryImpl: NewBaseRepository[models.Document](db),
	}
}

// GetByChecksum retrieves a document by checksum
func (r *DocumentRepositoryImpl) GetByChecksum(ctx context.Context, checksum string) (*models.Document, error) {
	var document models.Document
	err := r.db.WithContext(ctx).Where("checksum = ?", checksum).First(&document).Error
	if err != nil {
		return nil, err
	}
	return &document, nil
}

// GetByTenant retrieves paginated documents for a tenant
func (r *DocumentRepositoryImpl) GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.Document], error) {
	opts := QueryOptions{
		TenantID: tenantID,
		Preloads: []string{"Creator"},
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetByStatus retrieves documents by status for a tenant
func (r *DocumentRepositoryImpl) GetByStatus(ctx context.Context, tenantID, status string) ([]models.Document, error) {
	var documents []models.Document
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND (extraction_status = ? OR processing_status = ? OR dlp_status = ?)",
			tenantID, status, status, status).
		Find(&documents).Error
	return documents, err
}

// GetByCreator retrieves documents created by a specific user
func (r *DocumentRepositoryImpl) GetByCreator(ctx context.Context, tenantID, creatorID string, pagination Pagination) (PaginatedResult[models.Document], error) {
	opts := QueryOptions{
		TenantID: tenantID,
		Filters: map[string]any{
			"created_by": creatorID,
		},
		Preloads: []string{"Creator"},
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetByClassification retrieves documents by classification
func (r *DocumentRepositoryImpl) GetByClassification(ctx context.Context, tenantID, classification string) ([]models.Document, error) {
	var documents []models.Document
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND classification = ?", tenantID, classification).
		Find(&documents).Error
	return documents, err
}

// GetDocumentsNeedingProcessing retrieves documents that need processing
func (r *DocumentRepositoryImpl) GetDocumentsNeedingProcessing(ctx context.Context, tenantID string) ([]models.Document, error) {
	var documents []models.Document
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND (extraction_status = 'pending' OR processing_status = 'pending' OR dlp_status = 'pending')", tenantID).
		Order("created_at ASC").
		Limit(100).
		Find(&documents).Error
	return documents, err
}

// GetExpiredDocuments retrieves documents that have exceeded their retention period
func (r *DocumentRepositoryImpl) GetExpiredDocuments(ctx context.Context, tenantID string) ([]models.Document, error) {
	var documents []models.Document
	// This would need to be implemented based on retention policies
	// For now, return documents older than 1 year
	oneYearAgo := time.Now().AddDate(-1, 0, 0)
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND created_at < ?", tenantID, oneYearAgo).
		Find(&documents).Error
	return documents, err
}

// UpdateProcessingStatus updates document processing status
func (r *DocumentRepositoryImpl) UpdateProcessingStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&models.Document{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"processing_status": status,
			"updated_at":        time.Now(),
		}).Error
}

// UpdateExtractionStatus updates document text extraction status
func (r *DocumentRepositoryImpl) UpdateExtractionStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&models.Document{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"extraction_status": status,
			"updated_at":        time.Now(),
		}).Error
}

// UpdateDLPStatus updates document DLP scan status
func (r *DocumentRepositoryImpl) UpdateDLPStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&models.Document{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"dlp_status": status,
			"updated_at": time.Now(),
		}).Error
}

// UpdateMetadata updates document metadata
func (r *DocumentRepositoryImpl) UpdateMetadata(ctx context.Context, id string, metadata map[string]any) error {
	return r.db.WithContext(ctx).Model(&models.Document{}).
		Where("id = ?", id).
		Update("metadata", metadata).Error
}

// AddTag adds a tag to a document
func (r *DocumentRepositoryImpl) AddTag(ctx context.Context, id string, tag string) error {
	var document models.Document
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&document).Error; err != nil {
		return err
	}

	// Add tag to existing tags
	tags := make([]string, 0)
	if document.Tags != nil {
		tags = append(tags, document.Tags...)
	}

	// Check if tag already exists
	for _, existingTag := range tags {
		if existingTag == tag {
			return nil // Tag already exists
		}
	}

	tags = append(tags, tag)

	return r.db.WithContext(ctx).Model(&document).Update("tags", tags).Error
}

// RemoveTag removes a tag from a document
func (r *DocumentRepositoryImpl) RemoveTag(ctx context.Context, id string, tag string) error {
	var document models.Document
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&document).Error; err != nil {
		return err
	}

	// Remove tag from existing tags
	tags := make([]string, 0)
	if document.Tags != nil {
		for _, existingTag := range document.Tags {
			if existingTag != tag {
				tags = append(tags, existingTag)
			}
		}
	}

	return r.db.WithContext(ctx).Model(&document).Update("tags", tags).Error
}

// SearchDocuments performs document search
func (r *DocumentRepositoryImpl) SearchDocuments(ctx context.Context, tenantID string, query string, filters map[string]any, pagination Pagination) (PaginatedResult[models.Document], error) {
	db := r.db.WithContext(ctx).Model(&models.Document{}).Where("tenant_id = ?", tenantID)

	// Add text search
	if query != "" {
		db = db.Where("original_filename ILIKE ? OR content_type ILIKE ?",
			"%"+query+"%", "%"+query+"%")
	}

	// Apply filters
	for key, value := range filters {
		db = db.Where(key+" = ?", value)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return PaginatedResult[models.Document]{}, err
	}

	var documents []models.Document
	if err := db.Preload("Creator").
		Offset(pagination.Offset()).
		Limit(pagination.Limit()).
		Order("created_at DESC").
		Find(&documents).Error; err != nil {
		return PaginatedResult[models.Document]{}, err
	}

	return NewPaginatedResult(documents, total, pagination), nil
}

// SearchByContentType searches documents by content type
func (r *DocumentRepositoryImpl) SearchByContentType(ctx context.Context, tenantID, contentType string) ([]models.Document, error) {
	var documents []models.Document
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND content_type ILIKE ?", tenantID, "%"+contentType+"%").
		Find(&documents).Error
	return documents, err
}

// GetDocumentStatistics retrieves document statistics for a tenant
func (r *DocumentRepositoryImpl) GetDocumentStatistics(ctx context.Context, tenantID string) (*DocumentStats, error) {
	stats := &DocumentStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get total documents
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalDocuments).Error; err != nil {
		return nil, err
	}

	// Get processed documents
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ? AND processing_status = ?", tenantUUID, "completed").
		Count(&stats.ProcessedDocuments).Error; err != nil {
		return nil, err
	}

	// Get pending documents
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ? AND processing_status = ?", tenantUUID, "pending").
		Count(&stats.PendingDocuments).Error; err != nil {
		return nil, err
	}

	// Get failed documents
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ? AND processing_status = ?", tenantUUID, "failed").
		Count(&stats.FailedDocuments).Error; err != nil {
		return nil, err
	}

	// Get storage statistics
	var totalSize, avgSize int64
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ?", tenantUUID).
		Select("COALESCE(SUM(file_size), 0), COALESCE(AVG(file_size), 0)").
		Scan(&struct {
			Total *int64
			Avg   *int64
		}{&totalSize, &avgSize}).Error; err != nil {
		return nil, err
	}
	stats.TotalSize = totalSize
	stats.AverageSize = avgSize

	// Get chunk statistics
	var totalChunks, embeddedChunks, pendingEmbeddings int64
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&totalChunks).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "completed").
		Count(&embeddedChunks).Error; err != nil {
		return nil, err
	}

	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "pending").
		Count(&pendingEmbeddings).Error; err != nil {
		return nil, err
	}

	stats.TotalChunks = totalChunks
	stats.EmbeddedChunks = embeddedChunks
	stats.PendingEmbeddings = pendingEmbeddings

	return stats, nil
}

// GetStorageUsage retrieves storage usage statistics
func (r *DocumentRepositoryImpl) GetStorageUsage(ctx context.Context, tenantID string) (*StorageStats, error) {
	stats := &StorageStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get document storage usage
	var documentsSize int64
	if err := r.db.WithContext(ctx).Model(&models.Document{}).
		Where("tenant_id = ?", tenantUUID).
		Select("COALESCE(SUM(file_size), 0)").
		Scan(&documentsSize).Error; err != nil {
		return nil, err
	}

	stats.DocumentsSize = documentsSize
	stats.TotalUsed = documentsSize

	// Calculate usage percentage (assuming 100GB limit for example)
	totalLimit := int64(100 * 1024 * 1024 * 1024) // 100GB
	if totalLimit > 0 {
		stats.UsagePercent = float64(stats.TotalUsed) / float64(totalLimit) * 100
	}

	stats.Available = totalLimit - stats.TotalUsed

	return stats, nil
}

// DocumentChunkRepositoryImpl implements DocumentChunkRepository
type DocumentChunkRepositoryImpl struct {
	BaseRepositoryImpl[models.DocumentChunk]
}

// NewDocumentChunkRepository creates a new document chunk repository
func NewDocumentChunkRepository(db *gorm.DB) DocumentChunkRepository {
	return &DocumentChunkRepositoryImpl{
		BaseRepositoryImpl: NewBaseRepository[models.DocumentChunk](db),
	}
}

// GetByDocument retrieves paginated chunks for a document
func (r *DocumentChunkRepositoryImpl) GetByDocument(ctx context.Context, documentID string, pagination Pagination) (PaginatedResult[models.DocumentChunk], error) {
	opts := QueryOptions{
		Filters: map[string]any{
			"document_id": documentID,
		},
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetByTenant retrieves paginated chunks for a tenant
func (r *DocumentChunkRepositoryImpl) GetByTenant(ctx context.Context, tenantID string, pagination Pagination) (PaginatedResult[models.DocumentChunk], error) {
	opts := QueryOptions{
		TenantID: tenantID,
	}
	return r.ListWithOptions(ctx, pagination, opts)
}

// GetChunksNeedingEmbedding retrieves chunks that need embedding
func (r *DocumentChunkRepositoryImpl) GetChunksNeedingEmbedding(ctx context.Context, tenantID string) ([]models.DocumentChunk, error) {
	var chunks []models.DocumentChunk
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND embedding_status IN (?)", tenantID, []string{"pending", "failed"}).
		Order("created_at ASC").
		Limit(100).
		Find(&chunks).Error
	return chunks, err
}

// GetChunksByStatus retrieves chunks by embedding status
func (r *DocumentChunkRepositoryImpl) GetChunksByStatus(ctx context.Context, tenantID, status string) ([]models.DocumentChunk, error) {
	var chunks []models.DocumentChunk
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND embedding_status = ?", tenantID, status).
		Find(&chunks).Error
	return chunks, err
}

// UpdateEmbeddingStatus updates chunk embedding status
func (r *DocumentChunkRepositoryImpl) UpdateEmbeddingStatus(ctx context.Context, id, status string) error {
	return r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"embedding_status": status,
			"updated_at":       time.Now(),
		}).Error
}

// UpdateEmbedding updates chunk embedding data
func (r *DocumentChunkRepositoryImpl) UpdateEmbedding(ctx context.Context, id string, embedding []float32, processingTime int) error {
	return r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"embedding":          embedding,
			"embedding_status":   "completed",
			"processing_time_ms": processingTime,
			"updated_at":         time.Now(),
		}).Error
}

// UpdateTokenCount updates chunk token count
func (r *DocumentChunkRepositoryImpl) UpdateTokenCount(ctx context.Context, id string, tokenCount int) error {
	return r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"token_count": tokenCount,
			"updated_at":  time.Now(),
		}).Error
}

// VectorSearch performs vector similarity search
func (r *DocumentChunkRepositoryImpl) VectorSearch(ctx context.Context, tenantID string, queryVector []float32, limit int, threshold float32) ([]models.DocumentChunk, error) {
	var chunks []models.DocumentChunk

	// Using PostgreSQL pgvector extension
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT * FROM document_chunks
			WHERE tenant_id = ?
			AND embedding_status = 'completed'
			AND embedding IS NOT NULL
			AND 1 - (embedding <=> ?) > ?
			ORDER BY embedding <=> ?
			LIMIT ?
		`, tenantID, queryVector, threshold, queryVector, limit).
		Scan(&chunks).Error

	return chunks, err
}

// HybridSearch performs hybrid text and vector search
func (r *DocumentChunkRepositoryImpl) HybridSearch(ctx context.Context, tenantID string, queryText string, queryVector []float32, limit int, vectorWeight, textWeight float32) ([]models.DocumentChunk, error) {
	var chunks []models.DocumentChunk

	// Using PostgreSQL full-text search and vector similarity
	err := r.db.WithContext(ctx).
		Raw(`
			WITH text_search AS (
				SELECT *, ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', ?)) * ? as text_score
				FROM document_chunks
				WHERE tenant_id = ?
				AND to_tsvector('english', content) @@ plainto_tsquery('english', ?)
			),
			vector_search AS (
				SELECT *, (1 - (embedding <=> ?)) * ? as vector_score
				FROM document_chunks
				WHERE tenant_id = ?
				AND embedding_status = 'completed'
				AND embedding IS NOT NULL
			)
			SELECT COALESCE(ts.*, vs.*) as *
			FROM text_search ts
			FULL OUTER JOIN vector_search vs ON ts.id = vs.id
			WHERE COALESCE(ts.text_score, 0) + COALESCE(vs.vector_score, 0) > 0
			ORDER BY (COALESCE(ts.text_score, 0) + COALESCE(vs.vector_score, 0)) DESC
			LIMIT ?
		`, queryText, textWeight, tenantID, queryText, queryVector, vectorWeight, tenantID, limit).
		Scan(&chunks).Error

	return chunks, err
}

// GetChunkStatistics retrieves chunk statistics for a tenant
func (r *DocumentChunkRepositoryImpl) GetChunkStatistics(ctx context.Context, tenantID string) (*ChunkStats, error) {
	stats := &ChunkStats{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get total chunks
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&stats.TotalChunks).Error; err != nil {
		return nil, err
	}

	// Get embedded chunks
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "completed").
		Count(&stats.EmbeddedChunks).Error; err != nil {
		return nil, err
	}

	// Get pending embeddings
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "pending").
		Count(&stats.PendingEmbeddings).Error; err != nil {
		return nil, err
	}

	// Get failed embeddings
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "failed").
		Count(&stats.FailedEmbeddings).Error; err != nil {
		return nil, err
	}

	// Get token statistics
	var totalTokens, avgChunkSize, avgTokenCount int64
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ?", tenantUUID).
		Select("COALESCE(SUM(token_count), 0), COALESCE(AVG(content_length), 0), COALESCE(AVG(token_count), 0)").
		Scan(&struct {
			Tokens *int64
			Size   *int64
			Count  *int64
		}{&totalTokens, &avgChunkSize, &avgTokenCount}).Error; err != nil {
		return nil, err
	}

	stats.TotalTokens = totalTokens
	stats.AverageChunkSize = avgChunkSize
	stats.AverageTokenCount = avgTokenCount

	return stats, nil
}

// GetEmbeddingProgress retrieves embedding progress for a tenant
func (r *DocumentChunkRepositoryImpl) GetEmbeddingProgress(ctx context.Context, tenantID string) (*EmbeddingProgress, error) {
	progress := &EmbeddingProgress{}

	// Parse tenant ID
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	// Get total chunks
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ?", tenantUUID).
		Count(&progress.Total).Error; err != nil {
		return nil, err
	}

	// Get completed embeddings
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "completed").
		Count(&progress.Completed).Error; err != nil {
		return nil, err
	}

	// Get pending embeddings
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "pending").
		Count(&progress.Pending).Error; err != nil {
		return nil, err
	}

	// Get failed embeddings
	if err := r.db.WithContext(ctx).Model(&models.DocumentChunk{}).
		Where("tenant_id = ? AND embedding_status = ?", tenantUUID, "failed").
		Count(&progress.Failed).Error; err != nil {
		return nil, err
	}

	// Calculate in progress (rough estimate)
	progress.InProgress = progress.Total - progress.Completed - progress.Pending - progress.Failed

	// Calculate percentage
	if progress.Total > 0 {
		progress.Percent = float64(progress.Completed) / float64(progress.Total) * 100
	}

	return progress, nil
}
