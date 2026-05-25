package cli

import (
	"fmt"
	"os"
	"sync"
	"time"
)

// Spinner displays an animated spinner with a message.
//
// When stderr is not a TTY the animation loop is suppressed — printing
// \r frames into a captured stream produces literal carriage-return
// bytes in CI log viewers. In that case we emit just start/stop lines.
type Spinner struct {
	msg    string
	done   chan struct{}
	mu     sync.Mutex
	active bool
	// tty is cached at Start-time so a stderr swap mid-run can't flip
	// us into animation mode after we've committed to the silent path.
	tty bool
}

func NewSpinner() *Spinner { return &Spinner{} }

func (sp *Spinner) Start(msg string) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	sp.msg = msg
	sp.done = make(chan struct{})
	sp.active = true
	sp.tty = spinnerIsTTY()
	if !sp.tty {
		fmt.Fprintf(os.Stderr, "  %s %s\n", Yellow("·"), msg)
		return
	}
	go sp.run()
}

func (sp *Spinner) run() {
	frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
	i := 0
	for {
		select {
		case <-sp.done:
			return
		default:
			fmt.Fprintf(os.Stderr, "\r  %s %s", Yellow(frames[i%len(frames)]), sp.msg)
			i++
			time.Sleep(80 * time.Millisecond)
		}
	}
}

func (sp *Spinner) Stop(success bool) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	if !sp.active {
		return
	}
	if sp.tty {
		close(sp.done)
	}
	sp.active = false
	icon := CheckMark()
	if !success {
		icon = CrossMark()
	}
	if sp.tty {
		fmt.Fprintf(os.Stderr, "\r  %s %s\n", icon, sp.msg)
	} else {
		fmt.Fprintf(os.Stderr, "  %s %s\n", icon, sp.msg)
	}
}

// spinnerIsTTY reports whether stderr is a real terminal using the
// char-device stat bit. Overridable for tests via spinnerTTYFn.
var spinnerTTYFn = func() bool {
	info, err := os.Stderr.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}

func spinnerIsTTY() bool { return spinnerTTYFn() }
