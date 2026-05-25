package ai

import (
	sdlccore "github.com/finsavvyai/sdlc-core/ai"
	sdlccache "github.com/finsavvyai/sdlc-core/cache"
)

// Re-exports from github.com/finsavvyai/sdlc-core. The shared library
// is the source of truth for Provider abstractions, the fallback
// chain, retry policy, Anthropic + Bedrock clients, and the prompt
// cache. This file keeps all existing aegis call sites compiling
// unchanged after the extraction (commit referenced in CHANGELOG).
//
// Aegis-specific code (GemmaAdapter wrapping the multi-provider
// GemmaClient, the orchestrator, session/compaction, MCP hooks)
// stays in this package and is NOT in sdlc-core.

// ───── ai package ─────

type Provider = sdlccore.Provider
type AnthropicClient = sdlccore.AnthropicClient
type BedrockClient = sdlccore.BedrockClient
type FallbackChain = sdlccore.FallbackChain
type RetryProvider = sdlccore.RetryProvider
type GemmaClient = sdlccore.GemmaClient
type GemmaAdapter = sdlccore.GemmaAdapter
type ClawClient = sdlccore.ClawClient
type ProviderConfig = sdlccore.ProviderConfig

var NewAnthropicClient = sdlccore.NewAnthropicClient
var NewBedrockClient = sdlccore.NewBedrockClient
var NewFallbackChain = sdlccore.NewFallbackChain
var NewRetryProvider = sdlccore.NewRetryProvider
var NewGemmaClient = sdlccore.NewGemmaClient
var NewGemmaAdapter = sdlccore.NewGemmaAdapter
var NewClawClient = sdlccore.NewClawClient
var DetectProvider = sdlccore.DetectProvider

// ───── cache package (re-exported here since aegis callers used
// `ai.PromptCache` / `ai.NewPromptCache`) ─────

type PromptCache = sdlccache.PromptCache
type CacheEntry = sdlccache.CacheEntry

var NewPromptCache = sdlccache.NewPromptCache

// CacheLookup forwards to sdlccache.CacheLookup. Kept as a value
// alias so existing call signatures don't change.
var CacheLookup = sdlccache.CacheLookup
