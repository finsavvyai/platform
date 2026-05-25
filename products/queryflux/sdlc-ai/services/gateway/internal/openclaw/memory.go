package openclaw

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// ─── Memory Types (OpenClaw-Compatible) ──────────────────────────────

// MemoryEntry represents a single memory entry in OpenClaw format
type MemoryEntry struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"` // conversation, fact, event, task
	Content   string         `json:"content"`
	Metadata  MemoryMetadata `json:"metadata"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	Tags      []string       `json:"tags,omitempty"`
}

// MemoryMetadata provides additional context for memory entries
type MemoryMetadata struct {
	UserID     string                 `json:"user_id,omitempty"`
	SessionID  string                 `json:"session_id,omitempty"`
	AgentID    string                 `json:"agent_id,omitempty"`
	Source     string                 `json:"source,omitempty"`
	Importance int                    `json:"importance,omitempty"` // 1-10
	ExpiresAt  *time.Time             `json:"expires_at,omitempty"`
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
	Entry MemoryEntry `json:"entry"`
	Score float64     `json:"score"` // Relevance score (0-1)
}

// MemoryWriteRequest is the API request to store a memory entry
type MemoryWriteRequest struct {
	Type       string                 `json:"type"`
	Content    string                 `json:"content"`
	UserID     string                 `json:"user_id,omitempty"`
	SessionID  string                 `json:"session_id,omitempty"`
	AgentID    string                 `json:"agent_id,omitempty"`
	Importance int                    `json:"importance,omitempty"`
	Tags       []string               `json:"tags,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"`
}

// MemoryStats holds aggregate memory statistics
type MemoryStats struct {
	TotalEntries int            `json:"total_entries"`
	ByType       map[string]int `json:"by_type"`
	ByUser       map[string]int `json:"by_user"`
	OldestEntry  *time.Time     `json:"oldest_entry,omitempty"`
	NewestEntry  *time.Time     `json:"newest_entry,omitempty"`
}

// ─── Memory Service ─────────────────────────────────────────────────

// MemoryService provides OpenClaw-compatible memory management.
// Currently uses in-memory storage; can be swapped for R2/D1/PostgreSQL.
type MemoryService struct {
	entries map[string]*MemoryEntry
	mu      sync.RWMutex
	logger  *logrus.Logger
	tracer  trace.Tracer
}

// NewMemoryService creates a new memory service
func NewMemoryService(logger *logrus.Logger) *MemoryService {
	return &MemoryService{
		entries: make(map[string]*MemoryEntry),
		logger:  logger,
		tracer:  otel.Tracer("openclaw.memory"),
	}
}

// Write stores a new memory entry
func (ms *MemoryService) Write(ctx context.Context, req MemoryWriteRequest) (*MemoryEntry, error) {
	_, span := ms.tracer.Start(ctx, "MemoryService.Write")
	defer span.End()

	// Validate
	if req.Content == "" {
		return nil, fmt.Errorf("content is required")
	}
	if req.Type == "" {
		req.Type = "fact"
	}

	entry := &MemoryEntry{
		ID:      uuid.New().String(),
		Type:    req.Type,
		Content: req.Content,
		Metadata: MemoryMetadata{
			UserID:     req.UserID,
			SessionID:  req.SessionID,
			AgentID:    req.AgentID,
			Source:     "sdlc-ai-gateway",
			Importance: req.Importance,
			Extra:      req.Extra,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Tags:      req.Tags,
	}

	ms.mu.Lock()
	ms.entries[entry.ID] = entry
	ms.mu.Unlock()

	span.SetAttributes(
		attribute.String("memory.id", entry.ID),
		attribute.String("memory.type", entry.Type),
	)

	ms.logger.WithFields(logrus.Fields{
		"id":   entry.ID,
		"type": entry.Type,
		"user": req.UserID,
	}).Info("Memory entry written")

	return entry, nil
}

// Read retrieves a memory entry by ID
func (ms *MemoryService) Read(ctx context.Context, id string) (*MemoryEntry, error) {
	_, span := ms.tracer.Start(ctx, "MemoryService.Read")
	defer span.End()

	ms.mu.RLock()
	entry, ok := ms.entries[id]
	ms.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("memory entry not found: %s", id)
	}

	// Check expiration
	if entry.Metadata.ExpiresAt != nil && entry.Metadata.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("memory entry expired: %s", id)
	}

	return entry, nil
}

// Delete removes a memory entry
func (ms *MemoryService) Delete(ctx context.Context, id string) error {
	_, span := ms.tracer.Start(ctx, "MemoryService.Delete")
	defer span.End()

	ms.mu.Lock()
	defer ms.mu.Unlock()

	if _, ok := ms.entries[id]; !ok {
		return fmt.Errorf("memory entry not found: %s", id)
	}

	delete(ms.entries, id)

	ms.logger.WithField("id", id).Info("Memory entry deleted")
	return nil
}

// Search performs keyword-based search on memory entries
func (ms *MemoryService) Search(ctx context.Context, req MemorySearchRequest) ([]MemorySearchResult, error) {
	_, span := ms.tracer.Start(ctx, "MemoryService.Search")
	defer span.End()

	limit := req.Limit
	if limit <= 0 {
		limit = 10
	}

	ms.mu.RLock()
	defer ms.mu.RUnlock()

	var results []MemorySearchResult
	now := time.Now()
	queryLower := strings.ToLower(req.Query)

	for _, entry := range ms.entries {
		// Filter by expiration
		if !req.IncludeExpired && entry.Metadata.ExpiresAt != nil && entry.Metadata.ExpiresAt.Before(now) {
			continue
		}

		// Filter by type
		if req.Type != "" && entry.Type != req.Type {
			continue
		}

		// Filter by user
		if req.UserID != "" && entry.Metadata.UserID != req.UserID {
			continue
		}

		// Filter by session
		if req.SessionID != "" && entry.Metadata.SessionID != req.SessionID {
			continue
		}

		// Filter by min importance
		if req.MinImportance > 0 && entry.Metadata.Importance < req.MinImportance {
			continue
		}

		// Filter by tags
		if len(req.Tags) > 0 {
			tagMatch := false
			for _, entryTag := range entry.Tags {
				for _, filterTag := range req.Tags {
					if entryTag == filterTag {
						tagMatch = true
						break
					}
				}
				if tagMatch {
					break
				}
			}
			if !tagMatch {
				continue
			}
		}

		// Score: keyword match
		score := 0.0
		if queryLower != "" {
			contentLower := strings.ToLower(entry.Content)
			if strings.Contains(contentLower, queryLower) {
				count := strings.Count(contentLower, queryLower)
				score = float64(count) / float64(len(contentLower)+1) * 10
				if score > 1.0 {
					score = 1.0
				}
			} else {
				continue
			}
		} else {
			// No query — return all matching filters, sorted by recency
			score = float64(entry.CreatedAt.Unix()) / float64(time.Now().Unix())
		}

		// Boost by importance
		if entry.Metadata.Importance > 0 {
			score += float64(entry.Metadata.Importance) * 0.01
		}

		results = append(results, MemorySearchResult{
			Entry: *entry,
			Score: score,
		})
	}

	// Sort by score descending
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	// Apply limit
	if len(results) > limit {
		results = results[:limit]
	}

	span.SetAttributes(
		attribute.String("memory.query", req.Query),
		attribute.Int("memory.results", len(results)),
	)

	ms.logger.WithFields(logrus.Fields{
		"query": req.Query,
		"count": len(results),
	}).Info("Memory search completed")

	return results, nil
}

// List retrieves memory entries matching criteria (without scoring)
func (ms *MemoryService) List(ctx context.Context, req MemorySearchRequest) ([]*MemoryEntry, error) {
	_, span := ms.tracer.Start(ctx, "MemoryService.List")
	defer span.End()

	limit := req.Limit
	if limit <= 0 {
		limit = 50
	}

	ms.mu.RLock()
	defer ms.mu.RUnlock()

	var entries []*MemoryEntry

	for _, entry := range ms.entries {
		if req.Type != "" && entry.Type != req.Type {
			continue
		}
		if req.UserID != "" && entry.Metadata.UserID != req.UserID {
			continue
		}
		if req.SessionID != "" && entry.Metadata.SessionID != req.SessionID {
			continue
		}

		entries = append(entries, entry)
	}

	// Sort by created date descending
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].CreatedAt.After(entries[j].CreatedAt)
	})

	if len(entries) > limit {
		entries = entries[:limit]
	}

	return entries, nil
}

// GetStats returns aggregate memory statistics
func (ms *MemoryService) GetStats(ctx context.Context) MemoryStats {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	stats := MemoryStats{
		TotalEntries: len(ms.entries),
		ByType:       make(map[string]int),
		ByUser:       make(map[string]int),
	}

	for _, entry := range ms.entries {
		stats.ByType[entry.Type]++
		if entry.Metadata.UserID != "" {
			stats.ByUser[entry.Metadata.UserID]++
		}

		if stats.OldestEntry == nil || entry.CreatedAt.Before(*stats.OldestEntry) {
			t := entry.CreatedAt
			stats.OldestEntry = &t
		}
		if stats.NewestEntry == nil || entry.CreatedAt.After(*stats.NewestEntry) {
			t := entry.CreatedAt
			stats.NewestEntry = &t
		}
	}

	return stats
}

// ExportToMarkdown exports a memory entry to Markdown format (R2-compatible)
func (ms *MemoryService) ExportToMarkdown(entry *MemoryEntry) string {
	var sb strings.Builder

	// YAML frontmatter
	sb.WriteString("---\n")
	sb.WriteString(fmt.Sprintf("id: %s\n", entry.ID))
	sb.WriteString(fmt.Sprintf("type: %s\n", entry.Type))
	sb.WriteString(fmt.Sprintf("created_at: %s\n", entry.CreatedAt.Format(time.RFC3339)))
	sb.WriteString(fmt.Sprintf("updated_at: %s\n", entry.UpdatedAt.Format(time.RFC3339)))

	if entry.Metadata.UserID != "" {
		sb.WriteString(fmt.Sprintf("user_id: %s\n", entry.Metadata.UserID))
	}
	if entry.Metadata.SessionID != "" {
		sb.WriteString(fmt.Sprintf("session_id: %s\n", entry.Metadata.SessionID))
	}
	if entry.Metadata.AgentID != "" {
		sb.WriteString(fmt.Sprintf("agent_id: %s\n", entry.Metadata.AgentID))
	}
	if entry.Metadata.Importance > 0 {
		sb.WriteString(fmt.Sprintf("importance: %d\n", entry.Metadata.Importance))
	}
	if len(entry.Tags) > 0 {
		sb.WriteString(fmt.Sprintf("tags: [%s]\n", strings.Join(entry.Tags, ", ")))
	}

	if len(entry.Metadata.Extra) > 0 {
		extraJSON, _ := json.MarshalIndent(entry.Metadata.Extra, "", "  ")
		sb.WriteString(fmt.Sprintf("extra: %s\n", string(extraJSON)))
	}

	sb.WriteString("---\n\n")
	sb.WriteString(entry.Content)

	return sb.String()
}
