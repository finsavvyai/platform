package api

import (
	"github.com/aegis-aml/aegis/internal/ai"
	"github.com/aegis-aml/aegis/internal/storage"
)

// aiHandlerDeps bundles the pieces every AI endpoint needs. Reduces
// the signature explosion as features pile up (already 4 args, was
// going to 5 with cache). Keeping it a struct also lets tests
// construct partial deps without positional confusion.
type aiHandlerDeps struct {
	client AISummarizer
	audit  storage.AuditRepository
	quota  *AIQuotaEnforcer
	reqLog storage.AIRequestLogRepository
	cache  *ai.PromptCache
}
