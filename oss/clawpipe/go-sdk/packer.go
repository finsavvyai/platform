package clawpipe

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

// PackResult holds the compressed text and savings stats.
type PackResult struct {
	Packed         string
	OriginalTokens int
	PackedTokens   int
	Savings        string
}

// packerConfig controls Packer behaviour.
type packerConfig struct {
	MaxTokens          int
	Deduplication      bool
	StripBoilerplate   bool
	CompressWhitespace bool
}

var defaultPackerCfg = packerConfig{
	MaxTokens:          100_000,
	Deduplication:      true,
	StripBoilerplate:   true,
	CompressWhitespace: true,
}

// Packer compresses context to reduce token count.
type Packer struct{ cfg packerConfig }

// NewPacker creates a Packer with default settings.
func NewPacker() *Packer { return &Packer{cfg: defaultPackerCfg} }

// Pack compresses input (and optional system message) returning savings.
func (p *Packer) Pack(input, system string) PackResult {
	original := input
	if system != "" {
		original = system + "\n\n" + input
	}
	origTok := estimateTokens(original)
	packed := original

	if p.cfg.CompressWhitespace {
		packed = compressWhitespace(packed)
	}
	if p.cfg.Deduplication {
		packed = deduplicate(packed)
	}
	if p.cfg.StripBoilerplate {
		packed = stripBoilerplate(packed)
	}
	packed = truncateToLimit(packed, p.cfg.MaxTokens)

	packTok := estimateTokens(packed)
	pct := 0
	if origTok > 0 {
		pct = int(math.Round(float64(origTok-packTok) / float64(origTok) * 100))
	}
	if pct < 0 {
		pct = 0
	}
	return PackResult{
		Packed: packed, OriginalTokens: origTok,
		PackedTokens: packTok, Savings: fmt.Sprintf("%d%%", pct),
	}
}

func estimateTokens(s string) int {
	return (len(s) + 3) / 4
}

func compressWhitespace(s string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimRight(l, " \t")
	}
	joined := strings.Join(lines, "\n")
	joined = multiBlank.ReplaceAllString(joined, "\n\n")
	return strings.TrimSpace(joined)
}

var multiBlank = regexp.MustCompile(`\n{3,}`)

func deduplicate(s string) string {
	blocks := strings.Split(s, "\n\n")
	seen := map[string]bool{}
	var out []string
	for _, b := range blocks {
		norm := strings.TrimSpace(strings.ToLower(b))
		if norm == "" {
			continue
		}
		if len(norm) > 50 && seen[norm] {
			continue
		}
		seen[norm] = true
		out = append(out, b)
	}
	return strings.Join(out, "\n\n")
}

var boilerplateRes = []*regexp.Regexp{
	regexp.MustCompile(`(?m)^//\s*eslint-disable.*$`),
	regexp.MustCompile(`(?m)^//\s*@ts-(ignore|expect-error|nocheck).*$`),
	regexp.MustCompile(`(?m)^'use strict';?\s*$`),
	regexp.MustCompile(`(?m)^/\*\s*istanbul ignore (next|else)\s*\*/$`),
}

func stripBoilerplate(s string) string {
	for _, re := range boilerplateRes {
		s = re.ReplaceAllString(s, "")
	}
	s = multiBlank.ReplaceAllString(s, "\n\n")
	return strings.TrimSpace(s)
}

func truncateToLimit(s string, maxTokens int) string {
	maxChars := maxTokens * 4
	if len(s) <= maxChars {
		return s
	}
	trunc := s[:maxChars]
	last := strings.LastIndex(trunc, "\n")
	cut := maxChars
	if last > int(float64(maxChars)*0.8) {
		cut = last
	}
	return trunc[:cut] + "\n\n[Truncated — context exceeded budget]"
}
