package cli

import (
	"fmt"
	"os"
	"sync"
	"time"
)

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	dim    = "\033[2m"
	red    = "\033[31m"
	green  = "\033[32m"
	yellow = "\033[33m"
	blue   = "\033[34m"
)

func Green(s string) string  { return green + s + reset }
func Red(s string) string    { return red + s + reset }
func Yellow(s string) string { return yellow + s + reset }
func Blue(s string) string   { return blue + s + reset }
func Bold(s string) string   { return bold + s + reset }
func Dim(s string) string    { return dim + s + reset }

func CheckMark() string { return Green("\u2713") }
func CrossMark() string { return Red("\u2717") }
func Dot() string       { return Yellow("\u25cf") }

// Spinner displays an animated spinner with a message.
type Spinner struct {
	msg    string
	done   chan struct{}
	mu     sync.Mutex
	active bool
}

func NewSpinner() *Spinner { return &Spinner{} }

func (sp *Spinner) Start(msg string) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	sp.msg = msg
	sp.done = make(chan struct{})
	sp.active = true
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
	close(sp.done)
	sp.active = false
	icon := CheckMark()
	if !success {
		icon = CrossMark()
	}
	fmt.Fprintf(os.Stderr, "\r  %s %s\n", icon, sp.msg)
}

func ProgressBar(current, total int, label string) string {
	width := 30
	filled := width * current / total
	bar := ""
	for i := 0; i < width; i++ {
		if i < filled {
			bar += "█"
		} else {
			bar += "░"
		}
	}
	pct := 100 * current / total
	return fmt.Sprintf("  %s [%s] %d%%", label, Green(bar), pct)
}
