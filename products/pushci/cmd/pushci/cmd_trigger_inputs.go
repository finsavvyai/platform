package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// expandMatrix fans out inputs whose value contains commas into the
// full cartesian product. `env=dev,staging version=1,2` becomes 4
// dispatches: {dev,1}, {dev,2}, {staging,1}, {staging,2}. Values
// without commas are held constant across all cells.
func expandMatrix(in map[string]string) []map[string]string {
	if len(in) == 0 {
		return []map[string]string{nil}
	}
	cells := []map[string]string{{}}
	for k, v := range in {
		parts := strings.Split(v, ",")
		next := make([]map[string]string, 0, len(cells)*len(parts))
		for _, c := range cells {
			for _, p := range parts {
				clone := make(map[string]string, len(c)+1)
				for ck, cv := range c {
					clone[ck] = cv
				}
				clone[k] = strings.TrimSpace(p)
				next = append(next, clone)
			}
		}
		cells = next
	}
	return cells
}

// mergeInputs combines inline --input K=V pairs with the contents of
// an --input-file JSON blob. Inline values override file values so
// users can layer per-invocation overrides on top of a committed
// defaults file (mirrors act's --secret / --secret-file precedence).
func mergeInputs(inline []string, path string) (map[string]string, error) {
	out := make(map[string]string)
	if path != "" {
		if err := loadInputFile(path, out); err != nil {
			return nil, err
		}
	}
	for _, pair := range inline {
		k, v, ok := strings.Cut(pair, "=")
		if !ok {
			return nil, fmt.Errorf("invalid --input %q, expected KEY=VAL", pair)
		}
		out[strings.TrimSpace(k)] = strings.TrimSpace(v)
	}
	return out, nil
}

// loadInputFile reads a JSON object file into the target map. Values
// are coerced to strings because GitHub's workflow_dispatch inputs
// must be JSON strings (even for boolean/number workflow inputs; the
// action runtime coerces back on the GitHub side).
func loadInputFile(path string, into map[string]string) error {
	body, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read input file: %w", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return fmt.Errorf("parse input file: %w", err)
	}
	for k, v := range raw {
		into[k] = fmt.Sprintf("%v", v)
	}
	return nil
}
