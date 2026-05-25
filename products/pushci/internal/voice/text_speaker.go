package voice

import (
	"context"
	"fmt"
	"io"
)

// textSpeaker is the cross-platform fallback Speaker — prints the
// would-be-spoken line to a writer (stderr by default). Keeps the
// CLI portable until Piper / Voicebox land for Linux + Windows.
type textSpeaker struct {
	out io.Writer
}

func (t *textSpeaker) Name() string { return "text" }

func (t *textSpeaker) Say(ctx context.Context, text string, opts SayOptions) error {
	if MuteEnv() || text == "" {
		return nil
	}
	persona := opts.VoiceID
	if persona == "" {
		persona = "narrator"
	}
	_, err := fmt.Fprintf(t.out, "[voice:%s] %s\n", persona, text)
	return err
}
