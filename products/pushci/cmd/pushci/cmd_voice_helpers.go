package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/ai"
	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/voice"
)

func voiceListCmd() error {
	cli.Header("Voice personas")
	for _, p := range voice.ListPersonas() {
		fmt.Printf("  %s %s\n    %s\n    voice: %s\n\n",
			cli.Green(">>"), cli.Bold(p.Name), p.Description, p.VoiceID)
	}
	cli.Info("Pick one: pushci voice say \"hello\" --persona curb-style")
	return nil
}

func voiceSayCmd(ctx context.Context, args []string) error {
	persona, rest := splitPersonaFlag(args)
	useAI, rest := splitAIFlag(rest)
	text := strings.TrimSpace(strings.Join(rest, " "))
	if text == "" {
		return fmt.Errorf("voice say: text is required")
	}
	n := buildNarrator(persona, useAI)
	// Preview line goes through the same redactor so secrets in
	// user-supplied text don't appear on stdout either.
	cli.Info(fmt.Sprintf("[%s] %s", n.Persona.Name, voice.Redact(text)))
	return n.Say(ctx, text)
}

func voiceTestCmd(ctx context.Context, args []string) error {
	persona, rest := splitPersonaFlag(args)
	useAI, _ := splitAIFlag(rest)
	n := buildNarrator(persona, useAI)
	cli.Info(fmt.Sprintf("Testing persona: %s", cli.Bold(n.Persona.Name)))
	for _, ev := range []voice.Event{
		voice.EventStart, voice.EventStage, voice.EventPass,
		voice.EventFail, voice.EventDeploy, voice.EventRollback,
	} {
		n.Event(ctx, ev)
	}
	return nil
}

// buildNarrator constructs a Narrator and, when useAI is on,
// wires in the configured Anthropic/Groq/etc. client so Event()
// asks the model for a fresh in-character line. Caller still gets
// canned-phrase fallback automatically when AI fails or no key set.
func buildNarrator(persona string, useAI bool) *voice.Narrator {
	n := voice.NewNarrator(persona)
	if useAI {
		n.AI = ai.NewClient()
	}
	return n
}

// splitAIFlag pulls --ai out of args. Symmetric with splitPersonaFlag.
func splitAIFlag(args []string) (bool, []string) {
	out := make([]string, 0, len(args))
	on := false
	for _, a := range args {
		if a == "--ai" {
			on = true
			continue
		}
		out = append(out, a)
	}
	return on, out
}

// splitPersonaFlag pulls --persona <name> out of args. Returns the
// persona name (empty when absent) and the residual positional args.
func splitPersonaFlag(args []string) (string, []string) {
	out := make([]string, 0, len(args))
	persona := ""
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--persona", "-p":
			if i+1 < len(args) {
				persona = args[i+1]
				i++
			}
		default:
			if strings.HasPrefix(args[i], "--persona=") {
				persona = strings.TrimPrefix(args[i], "--persona=")
				continue
			}
			out = append(out, args[i])
		}
	}
	return persona, out
}
