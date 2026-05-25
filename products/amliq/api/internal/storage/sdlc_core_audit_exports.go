package storage

import "github.com/finsavvyai/sdlc-core/audit"

// Re-exports of the AI request log primitives from sdlc-core/audit.
// Existing aegis call sites used `storage.AIRequestLog`,
// `storage.AIRequestLogRepository`, `storage.InMemoryAIRequestLogRepo`
// — keep them compiling unchanged after the source-of-truth moved
// to sdlc-core.
//
// Aegis-specific storage repos (entities, alerts, screenings, etc.)
// stay in this package; only the AI request log moved.

type AIRequestLog = audit.AIRequestLog
type AIRequestLogRepository = audit.Repository
type InMemoryAIRequestLogRepo = audit.InMemoryRepository

var NewInMemoryAIRequestLogRepo = audit.NewInMemoryRepository
