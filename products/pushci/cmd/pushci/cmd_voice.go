package main

import (
	"context"
	"fmt"

	"github.com/finsavvyai/pushci/internal/cli"
)

// cmdVoice handles `pushci voice <subcommand>`:
//   - list                       — show built-in personas
//   - say <text> [--persona X]   — speak arbitrary text
//   - test [--persona X]         — fire one line per lifecycle event
func cmdVoice(ctx context.Context, args []string) error {
	if len(args) == 0 {
		printVoiceHelp()
		return nil
	}
	switch args[0] {
	case "list", "ls":
		return voiceListCmd()
	case "say":
		return voiceSayCmd(ctx, args[1:])
	case "test":
		return voiceTestCmd(ctx, args[1:])
	case "joke":
		return voiceJokeCmd(ctx, args[1:])
	case "install":
		return voiceInstallCmd(ctx, args[1:])
	case "listen":
		return voiceListenCmd(ctx, args[1:])
	case "-h", "--help", "help":
		printVoiceHelp()
		return nil
	}
	return fmt.Errorf("unknown voice subcommand: %s", args[0])
}

func printVoiceHelp() {
	cli.Header("PushCI Voice")
	fmt.Println("  pushci voice list                                Built-in personas")
	fmt.Println("  pushci voice say <text> [--persona X] [--ai]    Speak text")
	fmt.Println("  pushci voice test [--persona X] [--ai]          Demo every event line")
	fmt.Println("  pushci voice joke [--persona X] [--diff <ref>]  AI joke about your recent diff")
	fmt.Println("  pushci voice install <https-url>                Fetch + merge community voices.yml")
	fmt.Println("  pushci voice listen [--seconds N]               STT trigger (sox + GROQ_API_KEY)")
	fmt.Println()
	fmt.Println("  --ai                              Generate fresh in-character lines")
	fmt.Println("                                    via the configured AI provider")
	fmt.Println("                                    (ANTHROPIC_API_KEY / GROQ_API_KEY / etc.)")
	fmt.Println("  PUSHCI_VOICE=curb-style           Default persona")
	fmt.Println("  PUSHCI_VOICE_AI=1                 Enable AI commentary in pushci run")
	fmt.Println("  PUSHCI_VOICE_OFF=1                Mute all voice output")
}
