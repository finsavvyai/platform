//go:build spike
// +build spike

// Package llm — any-llm spike (BEAT-PLAN S1.2 reference).
//
// This file is gated behind the `spike` build tag so it does not pull
// any-llm-go into the production go.mod. The point is to size the
// LOC-reduction story: would replacing our hand-rolled openai/
// anthropic/bedrock/google/azure_openai adapters with one any-llm
// dispatcher buy us anything?
//
// Today's adapter LOC (≈Apr 2026):
//   openai.go         ~250
//   anthropic.go      ~180
//   azure_openai.go   ~120
//   bedrock.go        ~213
//   google.go         ~209
//   fallback.go       ~120
//   total             ~1,090 LOC across 6 files
//
// any-llm-go quickstart (per the upstream README, fetched 2026-04-27):
//
//   provider, err := openai.New()                  // or anthropic.New()
//   resp, err := provider.Generate(ctx, anyllm.Request{...})
//
// In our shape that becomes:
//
//   func newAnyLLMProvider(name string) (Provider, error) {
//       switch name {
//       case "openai":    return openai.New()
//       case "anthropic": return anthropic.New()
//       case "bedrock":   return bedrock.New()
//       case "vertex":    return vertex.New()
//       }
//       return nil, fmt.Errorf("unknown provider: %s", name)
//   }
//
// That replaces 5 hand-rolled adapters with ~12 LOC. Trade-offs:
//
//   + ~1,000 LOC removed; one upstream maintenance surface for
//     vendor-API drift (Anthropic adds a field → mozilla-ai/any-llm-go
//     ships an update, not us).
//   + Multi-provider Embed() out of the box.
//   + Built-in Ollama support helps the LOCAL_LLM dev story (QW2 above).
//
//   - any-llm-go requires go 1.25 — we just bumped to 1.25.0 so this
//     is fine, but worth noting for hot-fix branches still on 1.24.
//   - Adds a chunky transitive dep tree (anthropic-sdk-go, openai-go,
//     ollama, mozilla-ai-platform-client-go). Build time grows.
//   - Our Bedrock adapter does AWS SigV4 + eventstream framing the
//     way *we* want; any-llm-go's Bedrock path is general-purpose and
//     might not match our streaming expectations 1:1. Verify before
//     swap.
//
// Verdict (for the post-Sprint-1 PR): yes, swap. But replace
// providers ONE AT A TIME, with a recorded-fixture parity test per
// provider proving the new path returns the same shape on the same
// input. Don't big-bang the cutover.
//
// To enable this spike file in a local build (do NOT commit go.sum
// changes from this — keep them out of mainline):
//
//   cd services/gateway
//   go get github.com/mozilla-ai/any-llm-go@latest
//   go build -tags spike ./internal/infrastructure/llm/...
//
// Reference:
//   - upstream Go binding: https://github.com/mozilla-ai/any-llm-go
//   - upstream Python SDK: https://github.com/mozilla-ai/any-llm

package llm

import "context"

// anyLLMSketch is a non-functional placeholder kept here so a future
// PR that adds the dependency has a clear seam to fill. The build tag
// keeps this file out of normal compilations.
type anyLLMSketch struct{}

func (anyLLMSketch) Name() string { return "any-llm" }

// Generate is intentionally not wired. The real implementation lives
// in the post-Sprint-1 PR that adds any-llm-go to go.mod; this body
// is here so the file compiles under the `spike` tag and shows the
// expected callsite shape.
func (anyLLMSketch) Generate(ctx context.Context, req Request) (Response, error) {
	return Response{}, errSpikeNotEnabled
}

var errSpikeNotEnabled = anySpikeError("any-llm spike is documentation only; see file header")

type anySpikeError string

func (e anySpikeError) Error() string { return string(e) }
