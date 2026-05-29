package queue

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// BurstQueue handles queue-based overflow management for rate limiting
type BurstQueue struct {
	queues    map[string]*RequestQueue
	mutex     sync.RWMutex
	logger    *logrus.Logger
	storage   QueueStorage
	processor *QueueProcessor
	config    *QueueConfig
}

// QueueConfig defines queue configuration
type QueueConfig struct {
	DefaultSize       int           `json:"default_size"`
	MaxSize           int           `json:"max_size"`
	DefaultTimeout    time.Duration `json:"default_timeout"`
	MaxTimeout        time.Duration `json:"max_timeout"`
	BatchSize         int           `json:"batch_size"`
	ProcessingDelay   time.Duration `json:"processing_delay"`
	RetryAttempts     int           `json:"retry_attempts"`
	RetryDelay        time.Duration `json:"retry_delay"`
	PriorityLevels    int           `json:"priority_levels"`
	EnablePersistence bool          `json:"enable_persistence"`
}

// RequestQueue represents a queue for requests
type RequestQueue struct {
	ID         string        `json:"id"`
	Key        string        `json:"key"` // Rate limit key
	TenantID   string        `json:"tenant_id"`
	UserID     string        `json:"user_id"`
	Endpoint   string        `json:"endpoint"`
	Items      []*QueueItem  `json:"items"`
	Size       int           `json:"size"`
	MaxSize    int           `json:"max_size"`
	Timeout    time.Duration `json:"timeout"`
	CreatedAt  time.Time     `json:"created_at"`
	LastAccess time.Time     `json:"last_access"`
	Processing bool          `json:"processing"`
	Paused     bool          `json:"paused"`
	Statistics QueueStats    `json:"statistics"`
}

// QueueItem represents a queued request
type QueueItem struct {
	ID          string                 `json:"id"`
	Request     *QueuedRequest         `json:"request"`
	Priority    int                    `json:"priority"`
	QueuedAt    time.Time              `json:"queued_at"`
	ExpiresAt   time.Time              `json:"expires_at"`
	Attempts    int                    `json:"attempts"`
	MaxAttempts int                    `json:"max_attempts"`
	Status      string                 `json:"status"` // pending, processing, completed, failed, expired
	Result      *ProcessResult         `json:"result,omitempty"`
	Error       string                 `json:"error,omitempty"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// QueuedRequest represents a request that's been queued
type QueuedRequest struct {
	ID           string            `json:"id"`
	Method       string            `json:"method"`
	URL          string            `json:"url"`
	Headers      map[string]string `json:"headers"`
	Body         []byte            `json:"body"`
	QueryParams  map[string]string `json:"query_params"`
	RemoteAddr   string            `json:"remote_addr"`
	UserAgent    string            `json:"user_agent"`
	TenantID     string            `json:"tenant_id"`
	UserID       string            `json:"user_id"`
	Timeout      time.Duration     `json:"timeout"`
	Weight       int               `json:"weight"`
	OriginalTime time.Time         `json:"original_time"`
}

// ProcessResult represents the result of processing a queued request
type ProcessResult struct {
	Success        bool              `json:"success"`
	StatusCode     int               `json:"status_code"`
	Headers        map[string]string `json:"headers"`
	Body           []byte            `json:"body"`
	ProcessingTime time.Duration     `json:"processing_time"`
	RetryAfter     time.Duration     `json:"retry_after,omitempty"`
	Message        string            `json:"message,omitempty"`
}

// QueueStats provides statistics for a queue
type QueueStats struct {
	TotalEnqueued      int64         `json:"total_enqueued"`
	TotalProcessed     int64         `json:"total_processed"`
	TotalFailed        int64         `json:"total_failed"`
	TotalExpired       int64         `json:"total_expired"`
	AverageWaitTime    time.Duration `json:"average_wait_time"`
	AverageProcessTime time.Duration `json:"average_process_time"`
	SuccessRate        float64       `json:"success_rate"`
	CurrentSize        int           `json:"current_size"`
	PeakSize           int           `json:"peak_size"`
	LastUpdated        time.Time     `json:"last_updated"`
}

// QueueStorage interface for persisting queue data
type QueueStorage interface {
	StoreQueue(ctx context.Context, queue *RequestQueue) error
	GetQueue(ctx context.Context, queueID string) (*RequestQueue, error)
	DeleteQueue(ctx context.Context, queueID string) error
	GetExpiredQueues(ctx context.Context) ([]*RequestQueue, error)
	GetQueueStatistics(ctx context.Context, queueID string) (*QueueStats, error)
}

// QueueProcessor processes queued requests
type QueueProcessor struct {
	config     *QueueConfig
	logger     *logrus.Logger
	storage    QueueStorage
	processors map[string]RequestProcessor
}

// RequestProcessor interface for processing different types of requests
type RequestProcessor interface {
	Process(ctx context.Context, request *QueuedRequest) (*ProcessResult, error)
	CanProcess(request *QueuedRequest) bool
	Priority(request *QueuedRequest) int
}

// EnqueueResult represents the result of enqueueing a request
type EnqueueResult struct {
	Success  bool          `json:"success"`
	QueueID  string        `json:"queue_id,omitempty"`
	ItemID   string        `json:"item_id,omitempty"`
	Position int           `json:"position,omitempty"`
	WaitTime time.Duration `json:"wait_time,omitempty"`
	Reason   string        `json:"reason,omitempty"`
}

// NewBurstQueue creates a new burst queue manager
func NewBurstQueue(config *QueueConfig, storage QueueStorage, logger *logrus.Logger) *BurstQueue {
	queue := &BurstQueue{
		queues:  make(map[string]*RequestQueue),
		logger:  logger,
		storage: storage,
		config:  config,
	}

	// Initialize queue processor
	queue.processor = NewQueueProcessor(config, storage, logger)

	// Load existing queues
	if err := queue.loadQueues(context.Background()); err != nil {
		logger.WithError(err).Error("Failed to load existing queues")
	}

	// Start cleanup goroutine
	go queue.startCleanup()

	return queue
}

// EnqueueRequest adds a request to the appropriate queue
func (bq *BurstQueue) EnqueueRequest(ctx context.Context, request *QueuedRequest, priority int) (*EnqueueResult, error) {
	// Generate queue key
	queueKey := bq.generateQueueKey(request)

	bq.mutex.Lock()
	defer bq.mutex.Unlock()

	// Get or create queue
	queue, exists := bq.queues[queueKey]
	if !exists {
		queue = &RequestQueue{
			ID:         fmt.Sprintf("queue_%s_%d", queueKey, time.Now().UnixNano()),
			Key:        queueKey,
			TenantID:   request.TenantID,
			UserID:     request.UserID,
			Endpoint:   request.URL,
			Items:      make([]*QueueItem, 0),
			Size:       0,
			MaxSize:    bq.config.DefaultSize,
			Timeout:    bq.config.DefaultTimeout,
			CreatedAt:  time.Now(),
			LastAccess: time.Now(),
			Processing: false,
			Paused:     false,
			Statistics: QueueStats{
				LastUpdated: time.Now(),
			},
		}
		bq.queues[queueKey] = queue

		// Persist queue if enabled
		if bq.config.EnablePersistence {
			if err := bq.storage.StoreQueue(ctx, queue); err != nil {
				bq.logger.WithError(err).Error("Failed to persist new queue")
			}
		}
	}

	// Check if queue is full
	if queue.Size >= queue.MaxSize {
		// Try to upgrade queue size if possible
		if queue.MaxSize < bq.config.MaxSize {
			newSize := min(queue.MaxSize*2, bq.config.MaxSize)
			queue.MaxSize = newSize
			bq.logger.WithFields(logrus.Fields{
				"queue_id": queue.ID,
				"old_size": queue.Size,
				"new_size": newSize,
			}).Info("Queue size expanded")
		} else {
			// Queue is at maximum capacity
			return &EnqueueResult{
				Success: false,
				Reason:  fmt.Sprintf("Queue is full (max size: %d)", queue.MaxSize),
			}, nil
		}
	}

	// Create queue item
	item := &QueueItem{
		ID:          fmt.Sprintf("item_%d", time.Now().UnixNano()),
		Request:     request,
		Priority:    priority,
		QueuedAt:    time.Now(),
		ExpiresAt:   time.Now().Add(queue.Timeout),
		Attempts:    0,
		MaxAttempts: bq.config.RetryAttempts,
		Status:      "pending",
		Metadata:    make(map[string]interface{}),
	}

	// Add item to queue based on priority
	queue.Items = bq.insertItemByPriority(queue.Items, item)
	queue.Size++
	queue.LastAccess = time.Now()

	// Update statistics
	queue.Statistics.TotalEnqueued++
	queue.Statistics.CurrentSize = queue.Size
	if queue.Size > queue.Statistics.PeakSize {
		queue.Statistics.PeakSize = queue.Size
	}

	// Calculate wait time estimate
	waitTime := bq.calculateWaitTime(queue)

	// Start processing if not already processing
	if !queue.Processing && !queue.Paused {
		go bq.processQueue(queue.ID)
		queue.Processing = true
	}

	// Persist queue changes
	if bq.config.EnablePersistence {
		if err := bq.storage.StoreQueue(ctx, queue); err != nil {
			bq.logger.WithError(err).Error("Failed to persist queue changes")
		}
	}

	bq.logger.WithFields(logrus.Fields{
		"queue_id":   queue.ID,
		"item_id":    item.ID,
		"priority":   priority,
		"queue_size": queue.Size,
		"wait_time":  waitTime,
	}).Debug("Request enqueued")

	return &EnqueueResult{
		Success:  true,
		QueueID:  queue.ID,
		ItemID:   item.ID,
		Position: bq.getItemPosition(queue.Items, item.ID),
		WaitTime: waitTime,
	}, nil
}

// DequeueRequest removes and returns the next request from a queue
func (bq *BurstQueue) DequeueRequest(ctx context.Context, queueID string) (*QueueItem, error) {
	bq.mutex.Lock()
	defer bq.mutex.Unlock()

	queue, exists := bq.queues[queueID]
	if !exists {
		return nil, fmt.Errorf("queue not found: %s", queueID)
	}

	if len(queue.Items) == 0 {
		return nil, fmt.Errorf("queue is empty: %s", queueID)
	}

	// Get the next item (highest priority)
	item := queue.Items[0]
	queue.Items = queue.Items[1:]
	queue.Size--
	queue.LastAccess = time.Now()

	// Update statistics
	if item.Status == "completed" {
		queue.Statistics.TotalProcessed++
	} else if item.Status == "failed" {
		queue.Statistics.TotalFailed++
	}

	queue.Statistics.CurrentSize = queue.Size
	queue.Statistics.LastUpdated = time.Now()

	// Stop processing if queue is empty
	if len(queue.Items) == 0 {
		queue.Processing = false
	}

	return item, nil
}

// GetQueueStatus returns the status of a queue
func (bq *BurstQueue) GetQueueStatus(ctx context.Context, queueID string) (*RequestQueue, error) {
	bq.mutex.RLock()
	defer bq.mutex.RUnlock()

	queue, exists := bq.queues[queueID]
	if !exists {
		return nil, fmt.Errorf("queue not found: %s", queueID)
	}

	// Return a copy to prevent modification
	queueCopy := *queue
	queueCopy.Items = make([]*QueueItem, len(queue.Items))
	copy(queueCopy.Items, queue.Items)

	return &queueCopy, nil
}

// PauseQueue pauses processing of a queue
func (bq *BurstQueue) PauseQueue(ctx context.Context, queueID string) error {
	bq.mutex.Lock()
	defer bq.mutex.Unlock()

	queue, exists := bq.queues[queueID]
	if !exists {
		return fmt.Errorf("queue not found: %s", queueID)
	}

	queue.Paused = true
	bq.logger.WithField("queue_id", queueID).Info("Queue paused")

	return nil
}

// ResumeQueue resumes processing of a queue
func (bq *BurstQueue) ResumeQueue(ctx context.Context, queueID string) error {
	bq.mutex.Lock()
	defer bq.mutex.Unlock()

	queue, exists := bq.queues[queueID]
	if !exists {
		return fmt.Errorf("queue not found: %s", queueID)
	}

	queue.Paused = false

	// Start processing if queue has items and is not already processing
	if len(queue.Items) > 0 && !queue.Processing {
		go bq.processQueue(queue.ID)
		queue.Processing = true
	}

	bq.logger.WithField("queue_id", queueID).Info("Queue resumed")

	return nil
}

// GetQueueStatistics returns statistics for all queues
func (bq *BurstQueue) GetQueueStatistics(ctx context.Context) (map[string]*QueueStats, error) {
	bq.mutex.RLock()
	defer bq.mutex.RUnlock()

	statistics := make(map[string]*QueueStats)
	for queueID, queue := range bq.queues {
		statsCopy := queue.Statistics
		statistics[queueID] = &statsCopy
	}

	return statistics, nil
}

// Cleanup removes expired items and empty queues
func (bq *BurstQueue) Cleanup(ctx context.Context) error {
	bq.mutex.Lock()
	defer bq.mutex.Unlock()

	now := time.Now()
	var removedItems int
	var removedQueues int

	// Clean up expired items
	for queueID, queue := range bq.queues {
		var validItems []*QueueItem
		for _, item := range queue.Items {
			if now.Before(item.ExpiresAt) {
				validItems = append(validItems, item)
			} else {
				item.Status = "expired"
				queue.Statistics.TotalExpired++
				removedItems++
			}
		}

		if len(validItems) != len(queue.Items) {
			queue.Items = validItems
			queue.Size = len(validItems)
			queue.Statistics.CurrentSize = queue.Size
			queue.Statistics.LastUpdated = now
		}

		// Remove empty queues that haven't been accessed recently
		if len(queue.Items) == 0 && now.Sub(queue.LastAccess) > time.Hour {
			delete(bq.queues, queueID)
			removedQueues++
		}
	}

	if removedItems > 0 || removedQueues > 0 {
		bq.logger.WithFields(logrus.Fields{
			"removed_items":  removedItems,
			"removed_queues": removedQueues,
		}).Info("Queue cleanup completed")
	}

	return nil
}

// Helper methods

func (bq *BurstQueue) processQueue(queueID string) {
	defer func() {
		if r := recover(); r != nil {
			bq.logger.WithField("panic", r).Error("Queue processor panic recovered")
		}
	}()

	bq.processor.ProcessQueue(context.Background(), queueID)
}

func (bq *BurstQueue) generateQueueKey(request *QueuedRequest) string {
	// Create queue key based on tenant, user, and endpoint
	return fmt.Sprintf("%s:%s:%s", request.TenantID, request.UserID, request.URL)
}

func (bq *BurstQueue) insertItemByPriority(items []*QueueItem, newItem *QueueItem) []*QueueItem {
	// Find the correct position based on priority (higher priority first)
	for i, item := range items {
		if newItem.Priority > item.Priority {
			// Insert before this item
			return append(items[:i], append([]*QueueItem{newItem}, items[i:]...)...)
		}
	}

	// Add to the end if lowest priority
	return append(items, newItem)
}

func (bq *BurstQueue) getItemPosition(items []*QueueItem, itemID string) int {
	for i, item := range items {
		if item.ID == itemID {
			return i + 1 // 1-based position
		}
	}
	return -1
}

func (bq *BurstQueue) calculateWaitTime(queue *RequestQueue) time.Duration {
	if len(queue.Items) == 0 {
		return 0
	}

	// Simple estimation: average processing time * number of items ahead
	avgProcessTime := queue.Statistics.AverageProcessTime
	if avgProcessTime == 0 {
		avgProcessTime = 100 * time.Millisecond // Default estimate
	}

	return time.Duration(len(queue.Items)) * avgProcessTime
}

func (bq *BurstQueue) loadQueues(ctx context.Context) error {
	// Load queues from storage if persistence is enabled
	if bq.config.EnablePersistence {
		// This would load existing queues from storage
		// Implementation depends on the storage backend
		bq.logger.Info("Queue persistence enabled, but no storage loading implemented yet")
	}
	return nil
}

func (bq *BurstQueue) startCleanup() {
	ticker := time.NewTicker(time.Minute * 5) // Cleanup every 5 minutes
	defer ticker.Stop()

	for range ticker.C {
		if err := bq.Cleanup(context.Background()); err != nil {
			bq.logger.WithError(err).Error("Failed to cleanup queues")
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// NewQueueProcessor creates a new queue processor
func NewQueueProcessor(config *QueueConfig, storage QueueStorage, logger *logrus.Logger) *QueueProcessor {
	return &QueueProcessor{
		config:     config,
		logger:     logger,
		storage:    storage,
		processors: make(map[string]RequestProcessor),
	}
}

// ProcessQueue processes items in a queue
func (qp *QueueProcessor) ProcessQueue(ctx context.Context, queueID string) {
	for {
		// Load current queue state
		queue, err := qp.storage.GetQueue(ctx, queueID)
		if err != nil {
			qp.logger.WithError(err).WithField("queue_id", queueID).Error("Failed to load queue")
			return
		}

		// Check if queue is paused or empty
		if queue.Paused || len(queue.Items) == 0 {
			qp.logger.WithFields(logrus.Fields{
				"queue_id": queueID,
				"paused":   queue.Paused,
				"size":     len(queue.Items),
			}).Debug("Queue processing stopped")
			return
		}

		// Process next batch of items
		batchSize := min(qp.config.BatchSize, len(queue.Items))
		batch := queue.Items[:batchSize]

		var processedCount int
		for _, item := range batch {
			if qp.processItem(ctx, item) {
				processedCount++
			}
		}

		// Remove processed items
		if processedCount > 0 {
			queue.Items = queue.Items[processedCount:]
			queue.Size = len(queue.Items)
			queue.Statistics.CurrentSize = queue.Size
			queue.Statistics.LastUpdated = time.Now()

			// Save updated queue
			if err := qp.storage.StoreQueue(ctx, queue); err != nil {
				qp.logger.WithError(err).Error("Failed to save queue state")
			}
		}

		// Add delay between batches
		if qp.config.ProcessingDelay > 0 {
			time.Sleep(qp.config.ProcessingDelay)
		}
	}
}

func (qp *QueueProcessor) processItem(ctx context.Context, item *QueueItem) bool {
	// Check if item has expired
	if time.Now().After(item.ExpiresAt) {
		item.Status = "expired"
		return true
	}

	item.Status = "processing"
	item.Attempts++

	// Find appropriate processor
	var processor RequestProcessor
	for _, p := range qp.processors {
		if p.CanProcess(item.Request) {
			processor = p
			break
		}
	}

	if processor == nil {
		item.Status = "failed"
		item.Error = "No suitable processor found"
		return true
	}

	// Process the request
	result, err := processor.Process(ctx, item.Request)
	if err != nil {
		item.Error = err.Error()

		// Retry if attempts remaining
		if item.Attempts < item.MaxAttempts {
			item.Status = "pending"
			// Add delay before retry
			time.Sleep(qp.config.RetryDelay * time.Duration(item.Attempts))
			return false // Don't remove from queue
		} else {
			item.Status = "failed"
		}
	} else {
		item.Status = "completed"
		item.Result = result
	}

	return true
}
