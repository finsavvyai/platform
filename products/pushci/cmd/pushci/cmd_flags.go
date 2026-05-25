package main

import (
	"fmt"
	"strings"
)

// FlagSpec describes one flag a subcommand accepts. Long is the
// canonical form (e.g. "--dry-run"). Aliases are shorthands
// (e.g. "-n"). Takes is true if the flag consumes the next token
// as its value (e.g. "--stage name").
type FlagSpec struct {
	Long    string
	Aliases []string
	Takes   bool
}

// validateFlags rejects any --flag or -x token in args that isn't
// declared in specs. It handles both `--flag value` and
// `--flag=value` forms, and skips values that follow a Takes flag.
// Returns an error with a Levenshtein "did you mean" suggestion
// when possible. This is the guardrail for the teddk dogfood bug
// where `pushci run --drr-run` silently fell through to a real
// pipeline execution.
func validateFlags(cmd string, args []string, specs []FlagSpec) error {
	known := knownFlagSet(specs)
	i := 0
	for i < len(args) {
		a := args[i]
		if !strings.HasPrefix(a, "-") || a == "-" || a == "--" {
			i++
			continue
		}
		name := a
		if eq := strings.Index(a, "="); eq > 0 {
			name = a[:eq]
		}
		spec, ok := lookupSpec(name, specs)
		if !ok {
			return unknownFlagError(cmd, name, known)
		}
		i++
		if spec.Takes && !strings.Contains(a, "=") && i < len(args) {
			i++
		}
	}
	return nil
}

func knownFlagSet(specs []FlagSpec) []string {
	var all []string
	for _, s := range specs {
		all = append(all, s.Long)
		all = append(all, s.Aliases...)
	}
	return all
}

func lookupSpec(name string, specs []FlagSpec) (FlagSpec, bool) {
	for _, s := range specs {
		if s.Long == name {
			return s, true
		}
		for _, a := range s.Aliases {
			if a == name {
				return s, true
			}
		}
	}
	return FlagSpec{}, false
}

func unknownFlagError(cmd, name string, known []string) error {
	suggestion := nearestFlag(name, known)
	if suggestion != "" {
		return fmt.Errorf("unknown flag %q for %q. Did you mean %q?\nAvailable flags: %s", name, cmd, suggestion, strings.Join(known, ", "))
	}
	return fmt.Errorf("unknown flag %q for %q.\nAvailable flags: %s", name, cmd, strings.Join(known, ", "))
}
