package detect

import "strings"

// extractGradlePlugins collects plugin IDs from the plugins { ... }
// block, covering both Groovy `id 'x'` and Kotlin `id("x")` forms,
// plus the `kotlin("jvm")` shorthand. Returns an ordered, de-duped
// slice of IDs (nil when no plugins block is present).
func extractGradlePlugins(src string) []string {
	loc := rePluginsBlock.FindStringIndex(src)
	if loc == nil {
		return nil
	}
	body := balancedBlockBody(src, loc[0])
	if body == "" {
		return nil
	}
	seen := map[string]bool{}
	var ids []string
	add := func(id string) {
		if id == "" || seen[id] {
			return
		}
		seen[id] = true
		ids = append(ids, id)
	}
	for _, m := range rePluginID.FindAllStringSubmatch(body, -1) {
		if len(m) == 2 {
			add(m[1])
		}
	}
	for _, m := range reKotlinPlugin.FindAllStringSubmatch(body, -1) {
		if len(m) == 2 {
			add("org.jetbrains.kotlin." + m[1])
		}
	}
	return ids
}

// balancedBlockBody returns the contents of the first `{ ... }` block
// starting at or after `from`. Returns "" if the input is malformed.
func balancedBlockBody(src string, from int) string {
	brace := strings.Index(src[from:], "{")
	if brace < 0 {
		return ""
	}
	brace += from
	depth := 1
	for i := brace + 1; i < len(src); i++ {
		switch src[i] {
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[brace+1 : i]
			}
		}
	}
	return ""
}

// parseSettingsInclude extracts subproject paths from a
// settings.gradle[.kts] include() call. Accepts comma-separated
// literals in either parenthesised or bare-argument form.
func parseSettingsInclude(src string) []string {
	clean := stripGradleComments(src)
	var out []string
	seen := map[string]bool{}
	for _, m := range reSettingsInc.FindAllStringSubmatch(clean, -1) {
		if len(m) != 2 {
			continue
		}
		for _, lit := range reQuoted.FindAllStringSubmatch(m[1], -1) {
			if len(lit) != 2 {
				continue
			}
			name := strings.TrimPrefix(lit[1], ":")
			name = strings.ReplaceAll(name, ":", "/")
			if name == "" || seen[name] {
				continue
			}
			seen[name] = true
			out = append(out, name)
		}
	}
	return out
}
