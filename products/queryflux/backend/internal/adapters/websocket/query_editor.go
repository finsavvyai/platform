package websocket

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// EditOperation represents a text edit operation
type EditOperation struct {
	ID        string                 `json:"id"`
	Type      string                 `json:"type"` // "insert", "delete", "replace"
	Position  Position               `json:"position"`
	Content   string                 `json:"content"`
	Length    int                    `json:"length"`
	UserID    string                 `json:"user_id"`
	Timestamp time.Time              `json:"timestamp"`
	Version   int64                  `json:"version"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Position represents a position in the text editor
type Position struct {
	Line   int `json:"line"`
	Column int `json:"column"`
	Offset int `json:"offset"`
}

// TextRange represents a range of text
type TextRange struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

// QueryDocument represents a collaborative query document
type QueryDocument struct {
	ID          string               `json:"id"`
	Content     string               `json:"content"`
	Version     int64                `json:"version"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
	Operations  []EditOperation      `json:"operations"`
	Annotations []Annotation         `json:"annotations"`
	Locks       map[string]*EditLock `json:"locks"`
	mu          sync.RWMutex
}

// Annotation represents a text annotation (comment, error, etc.)
type Annotation struct {
	ID        string      `json:"id"`
	Type      string      `json:"type"` // "comment", "error", "warning", "suggestion"
	UserID    string      `json:"user_id"`
	Range     TextRange   `json:"range"`
	Content   string      `json:"content"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	Metadata  interface{} `json:"metadata,omitempty"`
}

// EditLock represents an edit lock on a text region
type EditLock struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Range     TextRange `json:"range"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
	Reason    string    `json:"reason,omitempty"`
}

// UserCursor represents a user's cursor in the editor
type UserCursor struct {
	UserID     string    `json:"user_id"`
	Position   Position  `json:"position"`
	Selection  TextRange `json:"selection"`
	IsActive   bool      `json:"is_active"`
	LastUpdate time.Time `json:"last_update"`
	Color      string    `json:"color"`
	Visible    bool      `json:"visible"`
}

// QueryEditorManager manages collaborative query editing
type QueryEditorManager struct {
	documents     map[string]*QueryDocument
	sessionDocs   map[string]string                 // sessionID -> documentID
	userCursors   map[string]map[string]*UserCursor // documentID -> userID -> cursor
	editLocks     map[string]map[string]*EditLock   // documentID -> lockID -> lock
	logger        *zap.Logger
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	operationChan chan EditOperation
	metrics       *EditorMetrics
}

// EditorMetrics tracks editor statistics
type EditorMetrics struct {
	TotalDocuments      int64 `json:"total_documents"`
	ActiveDocuments     int64 `json:"active_documents"`
	TotalOperations     int64 `json:"total_operations"`
	ConcurrentUsers     int64 `json:"concurrent_users"`
	CursorMovements     int64 `json:"cursor_movements"`
	EditConflicts       int64 `json:"edit_conflicts"`
	ResolvableConflicts int64 `json:"resolvable_conflicts"`
	AvgDocumentSize     int   `json:"avg_document_size"`
	TotalAnnotations    int64 `json:"total_annotations"`
	ActiveEditLocks     int64 `json:"active_edit_locks"`
	LockReleases        int64 `json:"lock_releases"`
	LockTimeouts        int64 `json:"lock_timeouts"`
}

// NewQueryEditorManager creates a new query editor manager
func NewQueryEditorManager(logger *zap.Logger) *QueryEditorManager {
	ctx, cancel := context.WithCancel(context.Background())

	return &QueryEditorManager{
		documents:     make(map[string]*QueryDocument),
		sessionDocs:   make(map[string]string),
		userCursors:   make(map[string]map[string]*UserCursor),
		editLocks:     make(map[string]map[string]*EditLock),
		logger:        logger,
		ctx:           ctx,
		cancel:        cancel,
		operationChan: make(chan EditOperation, 1000),
		metrics: &EditorMetrics{
			TotalDocuments:      0,
			ActiveDocuments:     0,
			TotalOperations:     0,
			ConcurrentUsers:     0,
			CursorMovements:     0,
			EditConflicts:       0,
			ResolvableConflicts: 0,
		},
	}
}

// Start starts the query editor manager
func (qem *QueryEditorManager) Start() error {
	qem.logger.Info("Starting query editor manager")

	// Start operation processor
	go qem.operationProcessor()

	// Start lock cleanup
	go qem.lockCleanup()

	// Start cursor cleanup
	go qem.cursorCleanup()

	return nil
}

// Stop stops the query editor manager
func (qem *QueryEditorManager) Stop() error {
	qem.cancel()
	close(qem.operationChan)

	qem.logger.Info("Query editor manager stopped")
	return nil
}

// CreateDocument creates a new query document
func (qem *QueryEditorManager) CreateDocument(content, sessionID string) (*QueryDocument, error) {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	documentID := uuid.New().String()

	document := &QueryDocument{
		ID:          documentID,
		Content:     content,
		Version:     1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Operations:  make([]EditOperation, 0),
		Annotations: make([]Annotation, 0),
		Locks:       make(map[string]*EditLock),
	}

	qem.documents[documentID] = document
	qem.sessionDocs[sessionID] = documentID
	qem.metrics.TotalDocuments++
	qem.metrics.ActiveDocuments++

	// Initialize cursor tracking for this document
	qem.userCursors[documentID] = make(map[string]*UserCursor)
	qem.editLocks[documentID] = make(map[string]*EditLock)

	qem.logger.Info("Query document created",
		zap.String("document_id", documentID),
		zap.String("session_id", sessionID),
		zap.Int("content_length", len(content)))

	return document, nil
}

// ApplyOperation applies an edit operation to a document
func (qem *QueryEditorManager) ApplyOperation(documentID, userID string, operation EditOperation) (*QueryDocument, error) {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	document, exists := qem.documents[documentID]
	if !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	// Check for edit conflicts
	if qem.hasEditConflict(documentID, operation) {
		qem.metrics.EditConflicts++
		return nil, fmt.Errorf("edit conflict detected")
	}

	// Apply operation
	updatedContent, err := qem.applyOperationToContent(document.Content, operation)
	if err != nil {
		return nil, fmt.Errorf("failed to apply operation: %w", err)
	}

	// Update document
	document.Content = updatedContent
	document.Version++
	document.UpdatedAt = time.Now()
	document.Operations = append(document.Operations, operation)

	// Update metrics
	qem.metrics.TotalOperations++

	qem.logger.Debug("Edit operation applied",
		zap.String("document_id", documentID),
		zap.String("user_id", userID),
		zap.String("operation_type", operation.Type),
		zap.Int64("version", document.Version))

	return document, nil
}

// UpdateCursor updates a user's cursor position
func (qem *QueryEditorManager) UpdateCursor(documentID, userID string, position Position, selection TextRange, color string) error {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	if _, exists := qem.documents[documentID]; !exists {
		return fmt.Errorf("document %s not found", documentID)
	}

	// Initialize cursor map if needed
	if qem.userCursors[documentID] == nil {
		qem.userCursors[documentID] = make(map[string]*UserCursor)
	}

	cursor := &UserCursor{
		UserID:     userID,
		Position:   position,
		Selection:  selection,
		IsActive:   true,
		LastUpdate: time.Now(),
		Color:      color,
		Visible:    true,
	}

	qem.userCursors[documentID][userID] = cursor
	qem.metrics.CursorMovements++

	qem.logger.Debug("Cursor updated",
		zap.String("document_id", documentID),
		zap.String("user_id", userID),
		zap.Int("line", position.Line),
		zap.Int("column", position.Column))

	return nil
}

// AddAnnotation adds an annotation to a document
func (qem *QueryEditorManager) AddAnnotation(documentID, userID, annotationType, content string, range_ TextRange) (*Annotation, error) {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	document, exists := qem.documents[documentID]
	if !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	annotation := &Annotation{
		ID:        uuid.New().String(),
		Type:      annotationType,
		UserID:    userID,
		Range:     range_,
		Content:   content,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	document.Annotations = append(document.Annotations, *annotation)
	document.UpdatedAt = time.Now()

	qem.metrics.TotalAnnotations++

	qem.logger.Info("Annotation added",
		zap.String("document_id", documentID),
		zap.String("user_id", userID),
		zap.String("annotation_type", annotationType),
		zap.String("annotation_id", annotation.ID))

	return annotation, nil
}

// AcquireEditLock acquires an edit lock on a text region
func (qem *QueryEditorManager) AcquireEditLock(documentID, userID, reason string, range_ TextRange) (*EditLock, error) {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	if _, exists := qem.documents[documentID]; !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	// Check for existing locks in the range
	for _, lock := range qem.editLocks[documentID] {
		if qem.rangesOverlap(lock.Range, range_) && lock.ExpiresAt.After(time.Now()) {
			return nil, fmt.Errorf("range is already locked by user %s", lock.UserID)
		}
	}

	lock := &EditLock{
		ID:        uuid.New().String(),
		UserID:    userID,
		Range:     range_,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute), // 5-minute lock timeout
		Reason:    reason,
	}

	qem.editLocks[documentID][lock.ID] = lock
	qem.metrics.ActiveEditLocks++

	qem.logger.Info("Edit lock acquired",
		zap.String("document_id", documentID),
		zap.String("user_id", userID),
		zap.String("lock_id", lock.ID),
		zap.String("reason", reason))

	return lock, nil
}

// ReleaseEditLock releases an edit lock
func (qem *QueryEditorManager) ReleaseEditLock(documentID, userID, lockID string) error {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	if _, exists := qem.documents[documentID]; !exists {
		return fmt.Errorf("document %s not found", documentID)
	}

	lock, exists := qem.editLocks[documentID][lockID]
	if !exists {
		return fmt.Errorf("lock %s not found", lockID)
	}

	// Check if user owns the lock
	if lock.UserID != userID {
		return fmt.Errorf("user %s does not own lock %s", userID, lockID)
	}

	delete(qem.editLocks[documentID], lockID)
	qem.metrics.ActiveEditLocks--
	qem.metrics.LockReleases++

	qem.logger.Info("Edit lock released",
		zap.String("document_id", documentID),
		zap.String("user_id", userID),
		zap.String("lock_id", lockID))

	return nil
}

// GetDocument returns a document by ID
func (qem *QueryEditorManager) GetDocument(documentID string) (*QueryDocument, error) {
	qem.mu.RLock()
	defer qem.mu.RUnlock()

	document, exists := qem.documents[documentID]
	if !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	// Return a copy to avoid race conditions
	documentCopy := &QueryDocument{
		ID:          document.ID,
		Content:     document.Content,
		Version:     document.Version,
		CreatedAt:   document.CreatedAt,
		UpdatedAt:   document.UpdatedAt,
		Operations:  make([]EditOperation, len(document.Operations)),
		Annotations: make([]Annotation, len(document.Annotations)),
		Locks:       make(map[string]*EditLock),
	}

	copy(document.Operations, documentCopy.Operations)
	copy(document.Annotations, documentCopy.Annotations)

	for lockID, lock := range document.Locks {
		lockCopy := *lock
		documentCopy.Locks[lockID] = &lockCopy
	}

	return documentCopy, nil
}

// GetDocumentBySession returns a document by session ID
func (qem *QueryEditorManager) GetDocumentBySession(sessionID string) (*QueryDocument, error) {
	qem.mu.RLock()
	documentID, exists := qem.sessionDocs[sessionID]
	qem.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no document found for session %s", sessionID)
	}

	return qem.GetDocument(documentID)
}

// GetActiveCursors returns all active cursors for a document
func (qem *QueryEditorManager) GetActiveCursors(documentID string) ([]*UserCursor, error) {
	qem.mu.RLock()
	defer qem.mu.RUnlock()

	if _, exists := qem.documents[documentID]; !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	cursors := make([]*UserCursor, 0)
	for _, cursor := range qem.userCursors[documentID] {
		if cursor.IsActive && time.Since(cursor.LastUpdate) < 5*time.Minute {
			cursorCopy := *cursor
			cursors = append(cursors, &cursorCopy)
		}
	}

	return cursors, nil
}

// GetActiveLocks returns all active edit locks for a document
func (qem *QueryEditorManager) GetActiveLocks(documentID string) ([]*EditLock, error) {
	qem.mu.RLock()
	defer qem.mu.RUnlock()

	if _, exists := qem.documents[documentID]; !exists {
		return nil, fmt.Errorf("document %s not found", documentID)
	}

	locks := make([]*EditLock, 0)
	for _, lock := range qem.editLocks[documentID] {
		if lock.ExpiresAt.After(time.Now()) {
			lockCopy := *lock
			locks = append(locks, &lockCopy)
		}
	}

	return locks, nil
}

// applyOperationToContent applies an operation to text content
func (qem *QueryEditorManager) applyOperationToContent(content string, operation EditOperation) (string, error) {
	switch operation.Type {
	case "insert":
		return qem.insertText(content, operation.Position, operation.Content)
	case "delete":
		return qem.deleteText(content, operation.Position, operation.Length)
	case "replace":
		newContent, err := qem.deleteText(content, operation.Position, operation.Length)
		if err != nil {
			return "", err
		}
		return qem.insertText(newContent, operation.Position, operation.Content)
	default:
		return "", fmt.Errorf("unsupported operation type: %s", operation.Type)
	}
}

// insertText inserts text at a specific position
func (qem *QueryEditorManager) insertText(content string, position Position, text string) (string, error) {
	lines := qem.splitLines(content)

	if position.Line < 0 || position.Line >= len(lines) {
		return "", fmt.Errorf("invalid line position: %d", position.Line)
	}

	line := lines[position.Line]
	if position.Column < 0 || position.Column > len(line) {
		return "", fmt.Errorf("invalid column position: %d", position.Column)
	}

	// Insert text
	newLine := line[:position.Column] + text + line[position.Column:]
	lines[position.Line] = newLine

	return qem.joinLines(lines), nil
}

// deleteText deletes text at a specific position
func (qem *QueryEditorManager) deleteText(content string, position Position, length int) (string, error) {
	if length <= 0 {
		return content, nil
	}

	lines := qem.splitLines(content)

	if position.Line < 0 || position.Line >= len(lines) {
		return "", fmt.Errorf("invalid line position: %d", position.Line)
	}

	line := lines[position.Line]
	if position.Column < 0 || position.Column >= len(line) {
		return "", fmt.Errorf("invalid column position: %d", position.Column)
	}

	endPosition := position.Column + length
	if endPosition > len(line) {
		endPosition = len(line)
	}

	// Delete text
	newLine := line[:position.Column] + line[endPosition:]
	lines[position.Line] = newLine

	return qem.joinLines(lines), nil
}

// splitLines splits content into lines
func (qem *QueryEditorManager) splitLines(content string) []string {
	// Simple line splitting - in practice, would handle different line endings
	return []string{content}
}

// joinLines joins lines back into content
func (qem *QueryEditorManager) joinLines(lines []string) string {
	// Simple line joining - in practice, would handle line endings
	result := ""
	for i, line := range lines {
		if i > 0 {
			result += "\n"
		}
		result += line
	}
	return result
}

// hasEditConflict checks if an operation conflicts with existing locks
func (qem *QueryEditorManager) hasEditConflict(documentID string, operation EditOperation) bool {
	if len(qem.editLocks[documentID]) == 0 {
		return false
	}

	// Create range for this operation
	operationRange := TextRange{
		Start: operation.Position,
		End:   operation.Position,
	}

	// Extend range based on operation type
	switch operation.Type {
	case "insert":
		// Insert affects position and following characters
		operationRange.End.Column += len(operation.Content)
	case "delete", "replace":
		// Delete/replace affects specified length
		operationRange.End.Column += operation.Length
	}

	// Check for overlapping locks
	for _, lock := range qem.editLocks[documentID] {
		if lock.ExpiresAt.After(time.Now()) && qem.rangesOverlap(lock.Range, operationRange) {
			return true
		}
	}

	return false
}

// rangesOverlap checks if two text ranges overlap
func (qem *QueryEditorManager) rangesOverlap(range1, range2 TextRange) bool {
	// Simple overlap check - in practice, would be more sophisticated
	return range1.Start.Line == range2.Start.Line && range1.Start.Line == range1.End.Line && range2.Start.Line == range2.End.Line &&
		range1.Start.Column <= range2.End.Column && range2.Start.Column <= range1.End.Column
}

// operationProcessor processes edit operations
func (qem *QueryEditorManager) operationProcessor() {
	for {
		select {
		case <-qem.ctx.Done():
			return
		case operation := <-qem.operationChan:
			qem.processOperation(operation)
		}
	}
}

// processOperation processes a single operation
func (qem *QueryEditorManager) processOperation(operation EditOperation) {
	// This would implement more complex operation processing
	// For now, just log the operation
	qem.logger.Debug("Processing operation",
		zap.String("operation_id", operation.ID),
		zap.String("type", operation.Type),
		zap.String("user_id", operation.UserID))
}

// lockCleanup removes expired edit locks
func (qem *QueryEditorManager) lockCleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-qem.ctx.Done():
			return
		case <-ticker.C:
			qem.cleanupExpiredLocks()
		}
	}
}

// cleanupExpiredLocks removes expired locks
func (qem *QueryEditorManager) cleanupExpiredLocks() {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	now := time.Now()
	for documentID, locks := range qem.editLocks {
		for lockID, lock := range locks {
			if lock.ExpiresAt.Before(now) {
				delete(qem.editLocks[documentID], lockID)
				qem.metrics.ActiveEditLocks--
				qem.metrics.LockTimeouts++

				qem.logger.Info("Edit lock expired and removed",
					zap.String("document_id", documentID),
					zap.String("lock_id", lockID),
					zap.String("user_id", lock.UserID))
			}
		}
	}
}

// cursorCleanup removes inactive cursors
func (qem *QueryEditorManager) cursorCleanup() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-qem.ctx.Done():
			return
		case <-ticker.C:
			qem.cleanupInactiveCursors()
		}
	}
}

// cleanupInactiveCursors removes inactive cursors
func (qem *QueryEditorManager) cleanupInactiveCursors() {
	qem.mu.Lock()
	defer qem.mu.Unlock()

	now := time.Now()
	for documentID, cursors := range qem.userCursors {
		for userID, cursor := range cursors {
			if now.Sub(cursor.LastUpdate) > 5*time.Minute {
				delete(qem.userCursors[documentID], userID)
				qem.logger.Debug("Inactive cursor removed",
					zap.String("document_id", documentID),
					zap.String("user_id", userID))
			}
		}
	}
}

// GetMetrics returns editor metrics
func (qem *QueryEditorManager) GetMetrics() EditorMetrics {
	qem.mu.RLock()
	defer qem.mu.RUnlock()

	return *qem.metrics
}
