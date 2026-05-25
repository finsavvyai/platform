package actions

import (
	"io"
	"os/exec"
	"sync"
)

// attachStreams wires the runner's writers and event channel to the
// child process pipes. We always pipe both stdout and stderr because
// act emits structured events on stdout and human noise on stderr.
func (r *Runner) attachStreams(cmd *exec.Cmd) (io.ReadCloser, io.ReadCloser, error) {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = stdout.Close()
		return nil, nil, err
	}
	return stdout, stderr, nil
}

// pump copies bytes from a child pipe to the user-supplied writer and,
// for stdout, also publishes structured events when r.Events is set.
func (r *Runner) pump(src io.ReadCloser, dst io.Writer, wait *sync.WaitGroup, isStdout bool) {
	defer wait.Done()
	defer src.Close()

	if r.Events != nil && isStdout {
		// Tee the stream so the user still sees raw output and we get
		// structured events from the same bytes.
		pr, pw := io.Pipe()
		go func() {
			defer pw.Close()
			if dst != nil {
				_, _ = io.Copy(io.MultiWriter(pw, dst), src)
			} else {
				_, _ = io.Copy(pw, src)
			}
		}()
		for ev := range ParseStream(pr) {
			r.Events <- ev
		}
		return
	}

	if dst != nil {
		_, _ = io.Copy(dst, src)
	} else {
		_, _ = io.Copy(io.Discard, src)
	}
}
