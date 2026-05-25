// Package llm provides a vendor-neutral provider abstraction with
// fallback-chain support across Anthropic, OpenAI, Google, AWS Bedrock,
// and Azure OpenAI.
//
// Day 49 of the production-ready roadmap.
//
// Each Provider implementation handles vendor-side auth + retry +
// token counting; the FallbackChain wraps a list and tries them in
// order until one succeeds.
package llm

import (
	"context"
	"errors"
	"time"
)

// Request is the shared input shape across providers.
type Request struct {
	Model       string
	Messages    []Message
	MaxTokens   int
	Temperature float32
	Stream      bool
}

// Message is one role+content pair.
type Message struct {
	Role    string // user | assistant | system | tool
	Content string
}

// Response is the shared output shape.
type Response struct {
	Content          string
	PromptTokens     int
	CompletionTokens int
	Model            string
	Provider         string
	Latency          time.Duration
	StopReason       string
}

// Provider is the contract every vendor adapter satisfies.
type Provider interface {
	Name() string
	Generate(ctx context.Context, req Request) (*Response, error)
	Embed(ctx context.Context, input []string) ([][]float32, error)
}

// StreamChunk is one slice of a streamed completion.
type StreamChunk struct {
	Delta string
	Done  bool
	Err   error
}

// Streamer is an optional interface; providers that support SSE
// streaming implement it. Callers should type-assert.
type Streamer interface {
	Stream(ctx context.Context, req Request) (<-chan StreamChunk, error)
}

// ErrNoProviders is returned when the chain is empty.
var ErrNoProviders = errors.New("llm: fallback chain has no providers")

// ErrEmbedUnsupported is returned by providers that do not expose
// an embeddings endpoint (e.g. Anthropic).
var ErrEmbedUnsupported = errors.New("llm: provider does not support embeddings")

// Tier categorises model cost so the routing policy (Day 50) can
// pick a cheap/balanced/premium tier per request.
type Tier string

const (
	TierCheap    Tier = "cheap"
	TierBalanced Tier = "balanced"
	TierPremium  Tier = "premium"
)
