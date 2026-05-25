package main

import (
	"os"
	"strings"
)

// parseKV parses a comma-separated KEY<sep>VAL list into a map. Used by
// the actions CLI flags --secrets / --env / --matrix where users want
// to pass small inline overrides without a separate file.
func parseKV(s, sep string) map[string]string {
	if s == "" {
		return nil
	}
	out := make(map[string]string)
	for _, pair := range strings.Split(s, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		k, v, found := strings.Cut(pair, sep)
		if !found {
			continue
		}
		out[strings.TrimSpace(k)] = strings.TrimSpace(v)
	}
	return out
}

// readKVFile reads a KEY=VALUE file (act's .secrets / .env format) into
// a map. Lines starting with # are treated as comments. Whitespace is
// trimmed around both key and value.
func readKVFile(path string) (map[string]string, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	out := make(map[string]string)
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		out[strings.TrimSpace(k)] = strings.TrimSpace(v)
	}
	return out, nil
}

// mergeMaps copies entries from src into dst. Existing keys in dst are
// overwritten — secret-file values win over inline --secrets so users
// can layer environment-specific overrides on top of a base file.
func mergeMaps(dst, src map[string]string) {
	if dst == nil {
		return
	}
	for k, v := range src {
		dst[k] = v
	}
}

// mergeInto is a nil-safe variant of mergeMaps that allocates dst when
// it's nil and returns the final map. Useful for optional flag parsing
// where the caller doesn't know up front whether any values exist.
func mergeInto(dst, src map[string]string) map[string]string {
	if dst == nil {
		dst = make(map[string]string, len(src))
	}
	for k, v := range src {
		dst[k] = v
	}
	return dst
}
