package clawpipe

import (
	"math"
	"regexp"
	"sort"
	"sync"
)

// ModelProfile describes a provider/model with cost and quality data.
type ModelProfile struct {
	Provider        string
	Model           string
	CostPer1kTokens float64
	AvgLatencyMs    float64
	QualityScore    float64
	MaxTokens       int
}

// learnedWeight tracks per-model outcomes.
type learnedWeight struct {
	TotalCalls  int
	AvgLatency  float64
	AvgTokenOut float64
	Score       float64
}

type taskComplexity int

const (
	simple  taskComplexity = iota
	medium
	complex
)

// DefaultModels is the built-in model catalogue.
var DefaultModels = []ModelProfile{
	{"deepseek", "deepseek-chat", 0.14, 800, 0.82, 64000},
	{"openai", "gpt-4o-mini", 0.15, 600, 0.85, 128000},
	{"anthropic", "claude-3-haiku", 0.25, 500, 0.88, 200000},
	{"openai", "gpt-4o", 2.5, 1200, 0.94, 128000},
	{"anthropic", "claude-sonnet-4", 3.0, 1000, 0.95, 200000},
	{"anthropic", "claude-opus-4", 15.0, 2000, 0.99, 200000},
	{"groq", "llama-3.1-70b", 0.59, 300, 0.80, 32000},
	{"mistral", "mistral-large", 2.0, 900, 0.90, 128000},
}

// Router selects the best provider/model for a prompt.
type Router struct {
	mu      sync.RWMutex
	models  []ModelProfile
	weights map[string]*learnedWeight
}

// NewRouter creates a Router with the default model catalogue.
func NewRouter() *Router {
	return &Router{models: DefaultModels, weights: map[string]*learnedWeight{}}
}

// Route picks the best model for the prompt and options.
func (r *Router) Route(prompt string, opts *PromptOptions) RouteDecision {
	if opts != nil && opts.Model != "" && opts.Provider != "" {
		return RouteDecision{opts.Provider, opts.Model, 1, "explicit"}
	}
	cx := classifyComplexity(prompt)
	candidates := r.rankCandidates(cx)

	r.mu.RLock()
	scored := make([]scoredModel, len(candidates))
	for i, c := range candidates {
		scored[i] = c
		key := c.Provider + ":" + c.Model
		if lw, ok := r.weights[key]; ok {
			scored[i].score += (lw.Score - 0.5) * 0.2
		}
	}
	r.mu.RUnlock()

	sort.Slice(scored, func(i, j int) bool { return scored[i].score > scored[j].score })
	b := scored[0]
	tag := "simple"
	if cx == medium {
		tag = "medium"
	} else if cx == complex {
		tag = "complex"
	}
	return RouteDecision{b.Provider, b.Model, b.score, "complexity=" + tag}
}

// Learn records an outcome for self-learning routing.
func (r *Router) Learn(rd RouteDecision, latencyMs float64, tokensOut int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := rd.Provider + ":" + rd.Model
	ex, ok := r.weights[key]
	if !ok {
		r.weights[key] = &learnedWeight{
			TotalCalls: 1, AvgLatency: latencyMs,
			AvgTokenOut: float64(tokensOut),
			Score:       computeLearnScore(latencyMs, float64(tokensOut)),
		}
		return
	}
	n := float64(ex.TotalCalls + 1)
	ex.AvgLatency += (latencyMs - ex.AvgLatency) / n
	ex.AvgTokenOut += (float64(tokensOut) - ex.AvgTokenOut) / n
	ex.TotalCalls = int(n)
	ex.Score = computeLearnScore(ex.AvgLatency, ex.AvgTokenOut)
}

var (
	codeRe = regexp.MustCompile("```[\\s\\S]+```|(?:function|class|const)\\s")
	stepRe = regexp.MustCompile(`(?i)\b(then|after that|next|finally|step \d)\b`)
)

func classifyComplexity(prompt string) taskComplexity {
	tokens := (len(prompt) + 3) / 4
	hasCode := codeRe.MatchString(prompt)
	hasMulti := stepRe.MatchString(prompt)
	if tokens > 2000 || (hasCode && hasMulti) {
		return complex
	}
	if tokens > 500 || hasCode || hasMulti {
		return medium
	}
	return simple
}

type scoredModel struct {
	ModelProfile
	score float64
}

func (r *Router) rankCandidates(cx taskComplexity) []scoredModel {
	var costW, qualW, speedW float64
	switch cx {
	case simple:
		costW, qualW = 0.6, 0.2
	case medium:
		costW, qualW = 0.3, 0.5
	default:
		costW, qualW = 0.1, 0.7
	}
	speedW = 1 - costW - qualW

	out := make([]scoredModel, len(r.models))
	for i, m := range r.models {
		cs := 1 - math.Min(m.CostPer1kTokens/15, 1)
		qs := m.QualityScore
		ss := 1 - math.Min(m.AvgLatencyMs/3000, 1)
		out[i] = scoredModel{m, costW*cs + qualW*qs + speedW*ss}
	}
	return out
}

func computeLearnScore(latMs, tokOut float64) float64 {
	ls := 1 - math.Min(latMs/5000, 1)
	es := math.Min(tokOut/1000, 1)
	return ls*0.5 + es*0.5
}

// ModelCount returns the number of known models.
func (r *Router) ModelCount() int { return len(r.models) }

// Complexity exports the classifier for testing.
func Complexity(prompt string) string {
	c := classifyComplexity(prompt)
	return []string{"simple", "medium", "complex"}[c]
}

