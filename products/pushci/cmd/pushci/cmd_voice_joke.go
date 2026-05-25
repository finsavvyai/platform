package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/voice"
)

// voiceJokeCmd implements `pushci voice joke` — passes a redacted
// `git diff --stat <ref>..HEAD` summary to the persona's LLM and
// speaks the response. AI is required (no canned-phrase mode for
// joke; the whole point is the model riffs on the actual code).
func voiceJokeCmd(ctx context.Context, args []string) error {
	persona, rest := splitPersonaFlag(args)
	ref, _ := splitDiffFlag(rest)
	n := buildNarrator(persona, true)
	if n.AI == nil || !n.AI.IsConfigured() {
		return fmt.Errorf("voice joke needs an AI provider configured " +
			"(ANTHROPIC_API_KEY / GROQ_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY)")
	}
	line := voice.JokeAboutDiff(ctx, n.AI, n.Persona, ref)
	if line == "" {
		cli.Warn("AI returned no usable line; speaking a canned phrase instead")
		n.Event(ctx, voice.EventDeploy)
		return nil
	}
	cli.Info(fmt.Sprintf("[%s] %s", n.Persona.Name, voice.Redact(line)))
	return n.Say(ctx, line)
}

// splitDiffFlag extracts --diff <ref> (or --diff=<ref>) from args.
// Empty ref defaults to HEAD~1 inside DiffSummary.
func splitDiffFlag(args []string) (string, []string) {
	out := make([]string, 0, len(args))
	ref := ""
	for i := 0; i < len(args); i++ {
		a := args[i]
		if a == "--diff" && i+1 < len(args) {
			ref = args[i+1]
			i++
			continue
		}
		if strings.HasPrefix(a, "--diff=") {
			ref = strings.TrimPrefix(a, "--diff=")
			continue
		}
		out = append(out, a)
	}
	return ref, out
}
