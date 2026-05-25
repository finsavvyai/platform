//go:build ignore

// Package services provides OpenClaw-compatible memory management for AI agents
package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

// MemoryEntry represents a single memory entry in OpenClaw format
type MemoryEntry struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // conversation, fact, event, task
	Content   string    `json:"content"`
	Metadata  Metadata  `json:"metadata"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Tags      []string  `json:"tags,omitempty"`
}

// Metadata provides additional context for memory entries
type Metadata struct {
	UserID     string                 `json:"user_id,omitempty"`
	SessionID  string                 `json:"session_id,omitempty"`
	AgentID    string                 `json:"agent_id,omitempty"`
	Source     string                 `json:"source,omitempty"`
	Importance int                    `json:"importance,omitempty"` // 1-10
	ExpiresAt  *time.Time             `json:"expires_at,omitempty"`
	Embedding  []float32              `json:"embedding,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"`
}

// MemorySearchRequest defines search parameters
type MemorySearchRequest struct {
	Query          string   `json:"query"`
	Type           string   `json:"type,omitempty"`
	UserID         string   `json:"user_id,omitempty"`
	SessionID      string   `json:"session_id,omitempty"`
	Tags           []string `json:"tags,omitempty"`
	Limit          int      `json:"limit,omitempty"`
	MinImportance  int      `json:"min_importance,omitempty"`
	IncludeExpired bool     `json:"include_expired,omitempty"`
}

// MemorySearchResult contains search results with relevance scores
type MemorySearchResult struct {
	Entry       MemoryEntry `json:"entry"`
	Score       float64     `json:"score"` // Combined BM25 + vector score
	BM25Score   float64     `json:"bm25_score"`
	VectorScore float64     `json:"vector_score,omitempty"`
}

// MemoryStore defines the interface for memory persistence
type MemoryStore interface {
	Write(ctx context.Context, entry *MemoryEntry) error
	Read(ctx context.Context, id string) (*MemoryEntry, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, filter *MemorySearchRequest) ([]*MemoryEntry, error)
}

// VectorSearcher defines the interface for semantic search
type VectorSearcher interface {
	Search(ctx context.Context, query string, entries []*MemoryEntry, limit int) ([]*MemorySearchResult, error)
	Embed(ctx context.Context, text string) ([]float32, error)
}

// BM25Searcher provides keyword-based search (BM25 algorithm)
type BM25Searcher interface {
	Search(ctx context.Context, query string, entries []*MemoryEntry, limit int) ([]*MemorySearchResult, error)
}

// MemoryService provides OpenClaw-compatible memory management
type MemoryService struct {
	store        MemoryStore
	vectorSearch VectorSearcher
	bm25Search   BM25Searcher
	logger       *logrus.Logger
	tracer       trace.Tracer
	defaultLimit int
}

// NewMemoryService creates a new memory service
func NewMemoryService(store MemoryStore, vectorSearch VectorSearcher, bm25 BM25Searcher, logger *logrus.Logger) *MemoryService {
	return &MemoryService{
		store:        store,
		vectorSearch: vectorSearch,
		bm25Search:   bm25,
		logger:       logger,
		tracer:       otel.Tracer("memory"),
		defaultLimit: 10,
	}
}

// Write stores a new memory entry
func (ms *MemoryService) Write(ctx context.Context, entryType, content string, metadata Metadata, tags []string) (*MemoryEntry, error) {
	ctx, span := ms.tracer.Start(ctx, "MemoryService.Write")
	defer span.End()

	entry := &MemoryEntry{
		ID:        uuid.New().String(),
		Type:      entryType,
		Content:   content,
		Metadata:  metadata,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Tags:      tags,
	}

	if err := ms.store.Write(ctx, entry); err != nil {
		ms.logger.WithError(err).WithField("id", entry.ID).Error("Failed to write memory entry")
		return nil, fmt.Errorf("write memory: %w", err)
	}

	ms.logger.WithFields(logrus.Fields{
		"id":   entry.ID,
		"type": entryType,
		"user": metadata.UserID,
	}).Info("Memory entry written")

	return entry, nil
}

// WriteFact stores a factual memory entry
func (ms *MemoryService) WriteFact(ctx context.Context, content string, userID string, importance int) (*MemoryEntry, error) {
	return ms.Write(ctx, "fact", content, Metadata{
		UserID:     userID,
		Importance: importance,
	}, nil)
}

// WriteConversation stores a conversation memory entry
func (ms *MemoryService) WriteConversation(ctx context.Context, content string, userID, sessionID string) (*MemoryEntry, error) {
	return ms.Write(ctx, "conversation", content, Metadata{
		UserID:    userID,
		SessionID: sessionID,
	}, []string{"conversation"})
}

// WriteEvent stores an event memory entry
func (ms *MemoryService) WriteEvent(ctx context.Context, content string, userID string, extra map[string]interface{}) (*MemoryEntry, error) {
	return ms.Write(ctx, "event", content, Metadata{
		UserID: userID,
		Extra:  extra,
	}, []string{"event"})
}

// Read retrieves a memory entry by ID
func (ms *MemoryService) Read(ctx context.Context, id string) (*MemoryEntry, error) {
	ctx, span := ms.tracer.Start(ctx, "MemoryService.Read")
	defer span.End()

	entry, err := ms.store.Read(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("read memory: %w", err)
	}

	// Check expiration
	if entry.Metadata.ExpiresAt != nil && entry.Metadata.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("memory entry expired")
	}

	return entry, nil
}

// Delete removes a memory entry
func (ms *MemoryService) Delete(ctx context.Context, id string) error {
	ctx, span := ms.tracer.Start(ctx, "MemoryService.Delete")
	defer span.End()

	if err := ms.store.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete memory: %w", err)
	}

	ms.logger.WithField("id", id).Info("Memory entry deleted")
	return nil
}

// Search performs hybrid BM25 + vector search on memory
func (ms *MemoryService) Search(ctx context.Context, req *MemorySearchRequest) ([]*MemorySearchResult, error) {
	ctx, span := ms.tracer.Start(ctx, "MemoryService.Search")
	defer span.End()

	limit := req.Limit
	if limit <= 0 {
		limit = ms.defaultLimit
	}

	// Retrieve candidate entries
	entries, err := ms.store.List(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("list memories: %w", err)
	}

	// Filter by expiration
	var validEntries []*MemoryEntry
	now := time.Now()
	for _, entry := range entries {
		if req.IncludeExpired || entry.Metadata.ExpiresAt == nil || entry.Metadata.ExpiresAt.After(now) {
			// Filter by min importance
			if req.MinImportance > 0 && entry.Metadata.Importance < req.MinImportance {
				continue
			}
			validEntries = append(validEntries, entry)
		}
	}

	if len(validEntries) == 0 {
		return []*MemorySearchResult{}, nil
	}

	// Perform BM25 search
	bm25Results := make(map[string]*MemorySearchResult)
	if ms.bm25Search != nil {
		bm25Hits, err := ms.bm25Search.Search(ctx, req.Query, validEntries, limit*2)
		if err != nil {
			ms.logger.WithError(err).Warn("BM25 search failed, using vector-only")
		} else {
			for _, hit := range bm25Hits {
				bm25Results[hit.Entry.ID] = hit
			}
		}
	}

	// Enhance with vector search if available
	results := make([]*MemorySearchResult, 0, limit)
	if ms.vectorSearch != nil {
		vectorHits, err := ms.vectorSearch.Search(ctx, req.Query, validEntries, limit*2)
		if err != nil {
			ms.logger.WithError(err).Warn("Vector search failed, using BM25-only")
			// Use BM25 results only
			for _, hit := range bm25Results {
				results = append(results, hit)
				if len(results) >= limit {
					break
				}
			}
		} else {
			// Combine BM25 and vector scores
			scored := make(map[string]*MemorySearchResult)
			for _, hit := range vectorHits {
				scored[hit.Entry.ID] = &MemorySearchResult{
					Entry:       hit.Entry,
					VectorScore: hit.Score,
				}
			}
			// Merge with BM25 scores (weighted combination)
			for _, bm25Hit := range bm25Results {
				if existing, ok := scored[bm25Hit.Entry.ID]; ok {
					// Weighted combination: 40% BM25, 60% vector
					existing.Score = 0.4*bm25Hit.BM25Score + 0.6*existing.VectorScore
					existing.BM25Score = bm25Hit.BM25Score
				} else {
					bm25Hit.Score = 0.4 * bm25Hit.BM25Score
					scored[bm25Hit.Entry.ID] = bm25Hit
				}
			}
			// Sort by combined score
			for _, hit := range scored {
				results = append(results, hit)
			}
		}
	} else {
		// BM25 only
		for _, hit := range bm25Results {
			results = append(results, hit)
			if len(results) >= limit {
				break
			}
		}
	}

	// Sort results by score
	sortResults(results)

	if len(results) > limit {
		results = results[:limit]
	}

	ms.logger.WithFields(logrus.Fields{
		"query": req.Query,
		"count": len(results),
	}).Info("Memory search completed")

	return results, nil
}

// SearchMemories is a convenience method for simple searches
func (ms *MemoryService) SearchMemories(ctx context.Context, query string, userID string, limit int) ([]*MemorySearchResult, error) {
	return ms.Search(ctx, &MemorySearchRequest{
		Query:  query,
		UserID: userID,
		Limit:  limit,
	})
}

// GetRecent retrieves recent memories for a user
func (ms *MemoryService) GetRecent(ctx context.Context, userID string, limit int) ([]*MemoryEntry, error) {
	entries, err := ms.store.List(ctx, &MemorySearchRequest{
		UserID: userID,
		Limit:  limit,
	})
	if err != nil {
		return nil, err
	}

	// Sort by created date desc
	sortEntriesByDate(entries)

	if len(entries) > limit {
		entries = entries[:limit]
	}

	return entries, nil
}

// GetBySession retrieves all memories for a session
func (ms *MemoryService) GetBySession(ctx context.Context, userID, sessionID string) ([]*MemoryEntry, error) {
	entries, err := ms.store.List(ctx, &MemorySearchRequest{
		UserID:    userID,
		SessionID: sessionID,
	})
	if err != nil {
		return nil, err
	}

	sortEntriesByDate(entries)
	return entries, nil
}

// ExportToMarkdown exports a memory entry to Markdown format
func (ms *MemoryService) ExportToMarkdown(entry *MemoryEntry) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Memory Entry: %s\n\n", entry.ID))
	sb.WriteString(fmt.Sprintf("**Type:** %s\n", entry.Type))
	sb.WriteString(fmt.Sprintf("**Created:** %s\n", entry.CreatedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("**Updated:** %s\n\n", entry.UpdatedAt.Format(time.RFC3339)))

	if len(entry.Tags) > 0 {
		sb.WriteString("**Tags:** " + strings.Join(entry.Tags, ", ") + "\n\n")
	}

	sb.WriteString("## Metadata\n\n")
	metadataJSON, _ := json.MarshalIndent(entry.Metadata, "", "  ")
	sb.WriteString("```json\n" + string(metadataJSON) + "\n```\n\n")

	sb.WriteString("## Content\n\n")
	sb.WriteString(entry.Content)

	return sb.String()
}

// sortResults sorts search results by score descending
func sortResults(results []*MemorySearchResult) {
	// Simple bubble sort for small slices
	n := len(results)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if results[j].Score < results[j+1].Score {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}
}

// sortEntriesByDate sorts entries by created date descending
func sortEntriesByDate(entries []*MemoryEntry) {
	n := len(entries)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if entries[j].CreatedAt.Before(entries[j+1].CreatedAt) {
				entries[j], entries[j+1] = entries[j+1], entries[j]
			}
		}
	}
}
