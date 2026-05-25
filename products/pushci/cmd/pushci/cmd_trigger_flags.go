package main

import (
	"flag"
	"fmt"
	"strings"
)

// triggerOptions is the parsed flag surface for `pushci trigger
// <workflow>`. Inputs are kept as []string so repeated --input flags
// preserve order; matrix fan-out happens later in expandMatrix.
type triggerOptions struct {
	Workflow  string
	Ref       string
	Inputs    map[string]string
	Watch     bool
	InputFile string
}

// inputFlagList implements flag.Value so --input can be repeated.
type inputFlagList []string

func (i *inputFlagList) String() string     { return strings.Join(*i, ",") }
func (i *inputFlagList) Set(v string) error { *i = append(*i, v); return nil }

// parseTriggerFlags parses positional + flag args. The workflow file
// can come as a bare positional arg OR via --workflow. Inputs from
// --input-file are merged under inline --input (inline wins).
func parseTriggerFlags(args []string) (*triggerOptions, error) {
	// Extract a leading positional before Go's flag package sees it —
	// flag.Parse stops at the first non-flag arg, which would strand
	// every subsequent --flag. Pulling the positional out first keeps
	// both `trigger ci.yml --ref x` and `trigger --workflow ci.yml`
	// working without a custom parser.
	positional, rest := splitLeadingPositional(args)
	fs := flag.NewFlagSet("trigger", flag.ContinueOnError)
	workflow := fs.String("workflow", "", "workflow filename or numeric ID")
	ref := fs.String("ref", "main", "git ref to dispatch against")
	watch := fs.Bool("watch", false, "stream run status after dispatch")
	inputFile := fs.String("input-file", "", "JSON file with inputs")
	var inputs inputFlagList
	fs.Var(&inputs, "input", "KEY=VAL workflow input (repeatable)")
	if err := fs.Parse(rest); err != nil {
		return nil, err
	}
	wf := resolveWorkflow(*workflow, append([]string{positional}, fs.Args()...))
	if wf == "" {
		return nil, fmt.Errorf("workflow required (positional or --workflow)")
	}
	parsed, err := mergeInputs(inputs, *inputFile)
	if err != nil {
		return nil, err
	}
	return &triggerOptions{
		Workflow: wf, Ref: *ref, Inputs: parsed,
		Watch: *watch, InputFile: *inputFile,
	}, nil
}

// resolveWorkflow picks the workflow ID/filename from either the
// --workflow flag or the first non-flag positional. Flag wins because
// users who type both presumably mean the explicit one.
func resolveWorkflow(flagVal string, rest []string) string {
	if flagVal != "" {
		return flagVal
	}
	for _, a := range rest {
		if a != "" && !strings.HasPrefix(a, "-") {
			return a
		}
	}
	return ""
}

// splitLeadingPositional returns (positional, remainingArgs). If the
// first arg is a flag we return "" and pass everything through. If
// the first arg is a bare positional we pull it out so flag.Parse
// can still see any trailing --flags.
func splitLeadingPositional(args []string) (string, []string) {
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		return args[0], args[1:]
	}
	return "", args
}
