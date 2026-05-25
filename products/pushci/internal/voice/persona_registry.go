package voice

import "strings"

// personaAliases keeps pre-rebrand env-var values working. Old
// celebrity-flavored names map to their style-named successors so
// `PUSHCI_VOICE=larry-david` keeps working for users on upgrade.
var personaAliases = map[string]string{
	"larry-david":   "curb-style",
	"michael-scott": "office-style",
	"gilfoyle":      "deadpan-tech",
}

// PersonaByName looks up a persona (built-in or user-loaded) by
// case-insensitive match on Name (or alias). Returns
// deadpanNarrator when unknown so callers always get something
// usable.
func PersonaByName(name string) Persona {
	if alias, ok := personaAliases[strings.ToLower(name)]; ok {
		name = alias
	}
	for _, p := range allPersonas() {
		if equalFold(p.Name, name) {
			return p
		}
	}
	return deadpanNarrator
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if 'A' <= ca && ca <= 'Z' {
			ca += 32
		}
		if 'A' <= cb && cb <= 'Z' {
			cb += 32
		}
		if ca != cb {
			return false
		}
	}
	return true
}
