package voice

import (
	"context"
	"fmt"
	"strconv"
)

// macSay drives the macOS /usr/bin/say binary. It's the zero-cost
// default backend — no API key, no network, no install. Voice IDs
// are macOS system voices (Daniel, Karen, Samantha, Fred, ...).
// Run `say -v ?` on a Mac to enumerate.
type macSay struct{}

func (m *macSay) Name() string { return "macos-say" }

func (m *macSay) Say(ctx context.Context, text string, opts SayOptions) error {
	if MuteEnv() || text == "" {
		return nil
	}
	args := buildSayArgs(text, opts)
	if err := runCmd(ctx, "say", args...); err != nil {
		return fmt.Errorf("macos-say: %w", err)
	}
	return nil
}

func buildSayArgs(text string, opts SayOptions) []string {
	args := []string{}
	if opts.VoiceID != "" {
		args = append(args, "-v", opts.VoiceID)
	}
	if opts.Rate > 0 {
		args = append(args, "-r", strconv.Itoa(opts.Rate))
	}
	if opts.OutFile != "" {
		args = append(args, "-o", opts.OutFile)
	}
	return append(args, text)
}
