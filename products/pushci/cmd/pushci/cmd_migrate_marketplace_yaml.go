package main

import (
	"sort"
	"strings"
)

// parseMarketplaceYaml extracts top-level `name` and each `inputs.*`
// entry from an action.yml. Minimal — no YAML dep required. See
// marketplace-action.ts for the TypeScript equivalent used by the API.
func parseMarketplaceYaml(raw string) marketplaceMeta {
	var name string
	inputs := map[string]*marketplaceInput{}
	order := []string{}
	inInputs := false
	var cur *marketplaceInput
	for _, rl := range strings.Split(raw, "\n") {
		line := strings.ReplaceAll(rl, "\t", "  ")
		if !inInputs {
			if v, ok := topKey(line, "name"); ok {
				name = v
			} else if strings.TrimSpace(line) == "inputs:" {
				inInputs = true
			}
			continue
		}
		if len(line) > 0 && line[0] != ' ' && strings.Contains(line, ":") {
			inInputs = false
			continue
		}
		if h, ok := inputHeader(line); ok {
			cur = &marketplaceInput{name: h}
			inputs[h] = cur
			order = append(order, h)
			continue
		}
		if cur == nil {
			continue
		}
		if k, v, ok := indentedField(line); ok {
			switch k {
			case "default":
				cur.def = v
			case "required":
				cur.required = strings.EqualFold(v, "true")
			}
		}
	}
	sort.Strings(order)
	ordered := make([]marketplaceInput, 0, len(order))
	for _, k := range order {
		ordered = append(ordered, *inputs[k])
	}
	m := marketplaceMeta{name: name, inputs: ordered}
	if len(ordered) == 0 {
		m.warnings = append(m.warnings, "action declares no inputs — may be a Docker/JS action without documented parameters")
	}
	return m
}
