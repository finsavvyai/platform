package ai

import (
	"os"
	"testing"
	"time"
)

func TestNewBedrockClient_EnvSweep(t *testing.T) {
	t.Setenv("AWS_BEDROCK_REGION", "")
	if c := NewBedrockClient(); c != nil {
		t.Error("nil expected when AWS_BEDROCK_REGION unset")
	}

	t.Setenv("AWS_BEDROCK_REGION", "us-east-1")
	t.Setenv("AWS_ACCESS_KEY_ID", "AKIA")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "secret")
	c := NewBedrockClient()
	if c == nil {
		t.Fatal("expected non-nil client when region + creds are set")
	}
	if !c.IsConfigured() {
		t.Error("expected IsConfigured true with creds")
	}
	if c.region != "us-east-1" {
		t.Errorf("region drift: %q", c.region)
	}
}

func TestBedrockClient_SetBaseURLTrimsTrailingSlash(t *testing.T) {
	c := &BedrockClient{}
	c.SetBaseURL("https://example.com/")
	if c.baseURL != "https://example.com" {
		t.Errorf("trailing slash not trimmed: %q", c.baseURL)
	}
}

func TestBedrockClient_SetClockReplacesNow(t *testing.T) {
	c := &BedrockClient{}
	frozen := time.Date(2026, 5, 4, 12, 0, 0, 0, time.UTC)
	c.SetClock(func() time.Time { return frozen })
	if got := c.now(); !got.Equal(frozen) {
		t.Errorf("SetClock didn't replace now: got %v want %v", got, frozen)
	}
}

// TestNewBedrockClient_ModelDefault asserts the env override path.
func TestNewBedrockClient_ModelDefault(t *testing.T) {
	t.Setenv("AWS_BEDROCK_REGION", "us-east-1")
	t.Setenv("AWS_BEDROCK_MODEL", "")
	c := NewBedrockClient()
	if c == nil {
		t.Fatal("nil client")
	}
	if c.model == "" {
		t.Error("default model not applied")
	}
	// Override case
	override := "anthropic.claude-3-5-sonnet"
	os.Setenv("AWS_BEDROCK_MODEL", override)
	defer os.Unsetenv("AWS_BEDROCK_MODEL")
	c2 := NewBedrockClient()
	if c2 == nil || c2.model != override {
		t.Errorf("override not honoured: %q", c2.model)
	}
}
