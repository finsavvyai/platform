package voice

import (
	"context"
	osexec "os/exec"
)

// exec runs a quick command and returns its trimmed stdout. Used by
// NewSpeaker probing for `say`; kept here so tests can stub it.
var exec = func(name string, args ...string) (string, error) {
	out, err := osexec.Command(name, args...).Output()
	return string(out), err
}

// runCmd runs a foreground command and waits for it to finish,
// honoring ctx cancellation. Backends call this to drive their
// underlying CLI tool (`say`, `piper`, `elevenlabs-cli`, etc).
func runCmd(ctx context.Context, name string, args ...string) error {
	cmd := osexec.CommandContext(ctx, name, args...)
	return cmd.Run()
}
