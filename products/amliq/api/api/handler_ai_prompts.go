package api

// AI summary prompt templates. Match the contract amliq-frontend's
// src/api/ai.ts already calls (type ∈ {alert, adverse_media, case})
// and the original ai_proxy.py reference impl. Kept short on purpose
// so the LLM context stays bounded; callers truncate text to 4000
// chars upstream.
var aiSummaryPrompts = map[string]string{
	"alert": "You are an AML compliance officer assistant. Summarize " +
		"this alert in 2-3 sentences. Focus on: entity name, risk " +
		"type, why it triggered, recommended action. Be concise " +
		"and factual.\n\nAlert data:\n%s",
	"adverse_media": "Summarize this adverse media article for a " +
		"compliance analyst in 2 sentences. Include: subject " +
		"entity, nature of allegation, source credibility " +
		"signals.\n\n%s",
	"case": "Summarize this compliance case for a senior reviewer in " +
		"3 bullet points. Cover: key risk indicators, evidence " +
		"gathered, recommended disposition.\n\n%s",
}

// validSummaryType reports whether t is a known summarization mode.
func validSummaryType(t string) bool {
	_, ok := aiSummaryPrompts[t]
	return ok
}
