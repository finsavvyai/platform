package ai

import (
	"fmt"
	"strings"
)

// CompactionConfig controls how sessions are compacted for long batches.
type CompactionConfig struct {
	MaxMessages    int // max messages before compaction triggers
	PreserveRecent int // keep this many recent messages intact
}

// DefaultCompactionConfig returns sensible defaults for batch screening.
func DefaultCompactionConfig() CompactionConfig {
	return CompactionConfig{MaxMessages: 50, PreserveRecent: 10}
}

// Compact summarizes older messages to free context space.
// Returns the compacted session with a summary replacing old turns.
func Compact(session *Session, cfg CompactionConfig) *Session {
	if len(session.Messages) <= cfg.MaxMessages {
		return session
	}

	cutoff := len(session.Messages) - cfg.PreserveRecent
	oldMessages := session.Messages[:cutoff]
	recentMessages := session.Messages[cutoff:]

	summary := summarizeMessages(oldMessages, session.EntityName)

	compacted := &Session{
		ID:         session.ID,
		TenantID:   session.TenantID,
		EntityName: session.EntityName,
		TokensUsed: session.TokensUsed,
		CreatedAt:  session.CreatedAt,
	}
	compacted.AddMessage(RoleSystem, summary)
	compacted.Messages = append(compacted.Messages, recentMessages...)
	return compacted
}

func summarizeMessages(messages []Message, entityName string) string {
	var toolsUsed []string
	var decisions []string
	screenCount := 0

	for _, msg := range messages {
		if msg.Role == RoleTool {
			screenCount++
		}
		for _, tc := range msg.ToolCalls {
			toolsUsed = append(toolsUsed, tc.Name)
		}
		if msg.Role == RoleAssistant && strings.Contains(msg.Content, "MATCH") {
			decisions = append(decisions, msg.Content[:min(100, len(msg.Content))])
		}
	}

	return fmt.Sprintf(
		"<summary>\nScreening session for %s. %d tool calls made (%s). "+
			"%d screening results processed. Key decisions: %s\n</summary>",
		entityName, screenCount, strings.Join(unique(toolsUsed), ", "),
		screenCount, strings.Join(decisions, "; "),
	)
}

func unique(items []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
