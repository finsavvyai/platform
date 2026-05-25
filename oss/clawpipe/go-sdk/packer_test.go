package clawpipe

import (
	"strings"
	"testing"
)

func TestPackerBasic(t *testing.T) {
	p := NewPacker()
	r := p.Pack("hello world", "")
	if r.Packed != "hello world" {
		t.Fatalf("unexpected: %q", r.Packed)
	}
}

func TestPackerWhitespace(t *testing.T) {
	p := NewPacker()
	input := "line1  \n\n\n\nline2"
	r := p.Pack(input, "")
	if strings.Contains(r.Packed, "\n\n\n") {
		t.Fatal("should collapse blank lines")
	}
}

func TestPackerDeduplication(t *testing.T) {
	p := NewPacker()
	block := strings.Repeat("a", 60)
	input := block + "\n\n" + block + "\n\n" + "unique block here"
	r := p.Pack(input, "")
	count := strings.Count(r.Packed, block)
	if count != 1 {
		t.Fatalf("expected 1 occurrence, got %d", count)
	}
}

func TestPackerShortBlocksNotDeduped(t *testing.T) {
	p := NewPacker()
	input := "hi\n\nhi\n\nhi"
	r := p.Pack(input, "")
	count := strings.Count(r.Packed, "hi")
	if count < 2 {
		t.Fatal("short blocks should not be deduped")
	}
}

func TestPackerSystem(t *testing.T) {
	p := NewPacker()
	r := p.Pack("prompt", "system msg")
	if !strings.Contains(r.Packed, "system msg") {
		t.Fatal("system message should be included")
	}
}

func TestPackerSavingsPercentage(t *testing.T) {
	p := NewPacker()
	input := "text  \n\n\n\n\n\nmore text  "
	r := p.Pack(input, "")
	if !strings.HasSuffix(r.Savings, "%") {
		t.Fatalf("savings should be a percentage, got %q", r.Savings)
	}
}

func TestPackerStripBoilerplate(t *testing.T) {
	p := NewPacker()
	input := "// eslint-disable-next-line\ncode here"
	r := p.Pack(input, "")
	if strings.Contains(r.Packed, "eslint") {
		t.Fatal("boilerplate should be stripped")
	}
}

func TestPackerTruncation(t *testing.T) {
	p := NewPacker()
	p.cfg.MaxTokens = 10 // 40 chars
	input := strings.Repeat("abcdefgh ", 20)
	r := p.Pack(input, "")
	if !strings.Contains(r.Packed, "[Truncated") {
		t.Fatal("should be truncated")
	}
}

func TestPackerEstimateTokens(t *testing.T) {
	tok := estimateTokens("12345678")
	if tok != 2 {
		t.Fatalf("expected 2, got %d", tok)
	}
}

func TestPackerEmptyInput(t *testing.T) {
	p := NewPacker()
	r := p.Pack("", "")
	if r.Savings != "0%" {
		t.Fatalf("expected 0%%, got %s", r.Savings)
	}
}

func TestPackerTsIgnoreStrip(t *testing.T) {
	p := NewPacker()
	input := "// @ts-ignore\ncode"
	r := p.Pack(input, "")
	if strings.Contains(r.Packed, "@ts-ignore") {
		t.Fatal("ts-ignore should be stripped")
	}
}
