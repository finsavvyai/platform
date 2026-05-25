package actions

import "sort"

func appendArchitecture(args []string, opts RunOptions) []string {
	if arch := opts.resolvedArchitecture(); arch != "" {
		return append(args, "--container-architecture", arch)
	}
	return args
}

func appendEventPayload(args []string, opts RunOptions) []string {
	if opts.EventPayload != "" {
		return append(args, "--eventpath", opts.EventPayload)
	}
	return args
}

func appendMatrixAndInputs(args []string, opts RunOptions) []string {
	for _, key := range sortedKeys(opts.Matrix) {
		args = append(args, "--matrix", key+":"+opts.Matrix[key])
	}
	for _, key := range sortedKeys(opts.Inputs) {
		args = append(args, "--input", key+"="+opts.Inputs[key])
	}
	return args
}

func appendPlatforms(args []string, opts RunOptions) []string {
	platforms := opts.resolvedPlatforms()
	for _, runner := range sortedKeys(platforms) {
		args = append(args, "-P", runner+"="+platforms[runner])
	}
	return args
}

// sortedKeys returns the keys of m in lexicographic order.
func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// runAll invokes a slice of cleanup callbacks in order.
func runAll(fns []func()) {
	for _, f := range fns {
		f()
	}
}
