package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/finsavvyai/pushci/internal/cli"
	"github.com/finsavvyai/pushci/internal/voice"
)

// voiceListenCmd implements `pushci voice listen [--seconds N]`.
// Records via sox, transcribes via Groq Whisper, parses the
// intent, and ALWAYS asks the user before dispatching the
// matched verb. Voice should never auto-execute destructive ops.
func voiceListenCmd(ctx context.Context, args []string) error {
	seconds := parseListenSeconds(args)
	cli.Info(fmt.Sprintf("Listening for %ds... speak now (Ctrl+C to cancel)", seconds))
	res, err := voice.Listen(ctx, seconds)
	if err != nil {
		return err
	}
	cli.Info(fmt.Sprintf("Heard: %q", voice.Redact(res.Transcript)))
	if res.Intent.Verb == "" {
		cli.Warn("No known verb (deploy / rollback / status / run) detected. Nothing dispatched.")
		return nil
	}
	cli.Info(fmt.Sprintf("Matched intent: %s (confidence %.0f%%)", res.Intent.Verb, res.Intent.Confidence*100))
	if !confirmDispatch(res.Intent.Verb) {
		cli.Warn("Cancelled.")
		return nil
	}
	cli.Success(fmt.Sprintf("Run: pushci %s", res.Intent.Verb))
	cli.Info("(Confirmation-only mode for now — voice never auto-executes destructive ops.)")
	return nil
}

func parseListenSeconds(args []string) int {
	for i, a := range args {
		if a == "--seconds" && i+1 < len(args) {
			if n, err := strconv.Atoi(args[i+1]); err == nil && n > 0 {
				return n
			}
		}
		if strings.HasPrefix(a, "--seconds=") {
			if n, err := strconv.Atoi(strings.TrimPrefix(a, "--seconds=")); err == nil && n > 0 {
				return n
			}
		}
	}
	return voice.CaptureSeconds
}

func confirmDispatch(verb string) bool {
	fmt.Printf("  Dispatch `pushci %s`? [y/N]: ", verb)
	r := bufio.NewReader(os.Stdin)
	answer, _ := r.ReadString('\n')
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "y" || answer == "yes"
}
