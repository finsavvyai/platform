//go:build ignore

// Package memory provides OpenClaw-compatible Markdown-based memory storage
package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// MarkdownR2Store stores memory entries as Markdown files in R2
type MarkdownR2Store struct {
	bucket   R2Bucket
	basePath string // e.g., "memory/users/{user_id}"
	logger   *logrus.Logger
}

// R2Bucket defines the interface for R2 operations
type R2Bucket interface {
	PutObject(ctx context.Context, key string, data []byte) error
	GetObject(ctx context.Context, key string) ([]byte, error)
	DeleteObject(ctx context.Context, key string) error
	ListObjects(ctx context.Context, prefix string) ([]string, error)
}

// NewMarkdownR2Store creates a new Markdown-based R2 store
func NewMarkdownR2Store(bucket R2Bucket, basePath string, logger *logrus.Logger) *MarkdownR2Store {
	return &MarkdownR2Store{
		bucket:   bucket,
		basePath: strings.TrimPrefix(basePath, "/"),
		logger:   logger,
	}
}

// Write stores a memory entry as a Markdown file
func (s *MarkdownR2Store) Write(ctx context.Context, entry *MemoryEntry) error {
	// Generate file path: memory/users/{user_id}/{type}/{id}.md
	filePath := s.getFilePath(entry)

	// Convert entry to Markdown with frontmatter
	markdown := s.entryToMarkdown(entry)

	// Write to R2
	if err := s.bucket.PutObject(ctx, filePath, []byte(markdown)); err != nil {
		return fmt.Errorf("r2 put: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"id":   entry.ID,
		"path": filePath,
	}).Debug("Memory entry written to R2")

	return nil
}

// Read retrieves a memory entry from R2
func (s *MarkdownR2Store) Read(ctx context.Context, id string) (*MemoryEntry, error) {
	// Try to find the file by listing
	entries, err := s.List(ctx, &MemorySearchRequest{})
	if err != nil {
		return nil, err
	}

	// Find entry by ID
	for _, entry := range entries {
		if entry.ID == id {
			return entry, nil
		}
	}

	return nil, fmt.Errorf("memory entry not found: %s", id)
}

// Delete removes a memory entry from R2
func (s *MarkdownR2Store) Delete(ctx context.Context, id string) error {
	// Need to find the file path first
	entries, err := s.List(ctx, &MemorySearchRequest{})
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.ID == id {
			filePath := s.getFilePath(entry)
			if err := s.bucket.DeleteObject(ctx, filePath); err != nil {
				return fmt.Errorf("r2 delete: %w", err)
			}
			return nil
		}
	}

	return fmt.Errorf("memory entry not found: %s", id)
}

// List retrieves memory entries matching criteria
func (s *MarkdownR2Store) List(ctx context.Context, req *MemorySearchRequest) ([]*MemoryEntry, error) {
	// Build search prefix
	prefix := s.basePath
	if req.UserID != "" {
		prefix = path.Join(prefix, "users", req.UserID)
	}

	// List objects from R2
	keys, err := s.bucket.ListObjects(ctx, prefix+"/")
	if err != nil {
		return nil, fmt.Errorf("r2 list: %w", err)
	}

	var entries []*MemoryEntry
	for _, key := range keys {
		// Skip non-markdown files
		if !strings.HasSuffix(key, ".md") {
			continue
		}

		// Read file content
		data, err := s.bucket.GetObject(ctx, key)
		if err != nil {
			s.logger.WithError(err).WithField("key", key).Warn("Failed to read memory file")
			continue
		}

		// Parse Markdown
		entry, err := s.markdownToEntry(data)
		if err != nil {
			s.logger.WithError(err).WithField("key", key).Warn("Failed to parse memory file")
			continue
		}

		// Apply filters
		if !s.matchesFilters(entry, req) {
			continue
		}

		entries = append(entries, entry)
	}

	return entries, nil
}

// getFilePath generates the R2 key for a memory entry
func (s *MarkdownR2Store) getFilePath(entry *MemoryEntry) string {
	// Structure: memory/users/{user_id}/{type}/{id}.md
	userID := entry.Metadata.UserID
	if userID == "" {
		userID = "shared"
	}

	return path.Join(
		s.basePath,
		"users",
		userID,
		entry.Type,
		entry.ID+".md",
	)
}

// entryToMarkdown converts a memory entry to Markdown format with frontmatter
func (s *MarkdownR2Store) entryToMarkdown(entry *MemoryEntry) string {
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
	if !entry.Metadata.ExpiresAt.IsZero() {
		sb.WriteString(fmt.Sprintf("expires_at: %s\n", entry.Metadata.ExpiresAt.Format(time.RFC3339)))
	}

	// Extra metadata as JSON
	if len(entry.Metadata.Extra) > 0 {
		extraJSON, _ := json.Marshal(entry.Metadata.Extra)
		sb.WriteString(fmt.Sprintf("extra: %s\n", string(extraJSON)))
	}

	sb.WriteString("---\n\n")
	sb.WriteString(entry.Content)

	return sb.String()
}

// markdownToEntry parses a Markdown file with frontmatter into a MemoryEntry
func (s *MarkdownR2Store) markdownToEntry(data []byte) (*MemoryEntry, error) {
	lines := strings.Split(string(data), "\n")
	entry := &MemoryEntry{
		Metadata: Metadata{Extra: make(map[string]interface{})},
	}

	// Parse frontmatter
	inFrontmatter := false
	frontmatterLines := []string{}
	contentLines := []string{}

	for i, line := range lines {
		if i == 0 && line == "---" {
			inFrontmatter = true
			continue
		}
		if inFrontmatter && line == "---" {
			inFrontmatter = false
			continue
		}
		if inFrontmatter {
			frontmatterLines = append(frontmatterLines, line)
		} else {
			contentLines = append(contentLines, line)
		}
	}

	// Parse YAML frontmatter
	for _, line := range frontmatterLines {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		switch key {
		case "id":
			entry.ID = value
		case "type":
			entry.Type = value
		case "created_at":
			entry.CreatedAt, _ = time.Parse(time.RFC3339, value)
		case "updated_at":
			entry.UpdatedAt, _ = time.Parse(time.RFC3339, value)
		case "user_id":
			entry.Metadata.UserID = value
		case "session_id":
			entry.Metadata.SessionID = value
		case "agent_id":
			entry.Metadata.AgentID = value
		case "importance":
			fmt.Sscanf(value, "%d", &entry.Metadata.Importance)
		case "tags":
			tagsStr := strings.Trim(value, "[]")
			if tagsStr != "" {
				entry.Tags = strings.Split(tagsStr, ",")
				for i := range entry.Tags {
					entry.Tags[i] = strings.TrimSpace(entry.Tags[i])
				}
			}
		case "expires_at":
			expiresAt, _ := time.Parse(time.RFC3339, value)
			entry.Metadata.ExpiresAt = &expiresAt
		case "extra":
			json.Unmarshal([]byte(value), &entry.Metadata.Extra)
		}
	}

	// Content is everything after frontmatter
	entry.Content = strings.Join(contentLines, "\n")

	return entry, nil
}

// matchesFilters checks if an entry matches the search filters
func (s *MarkdownR2Store) matchesFilters(entry *MemoryEntry, req *MemorySearchRequest) bool {
	// Filter by type
	if req.Type != "" && entry.Type != req.Type {
		return false
	}

	// Filter by user
	if req.UserID != "" && entry.Metadata.UserID != req.UserID {
		return false
	}

	// Filter by session
	if req.SessionID != "" && entry.Metadata.SessionID != req.SessionID {
		return false
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
		}
		if !tagMatch {
			return false
		}
	}

	return true
}
