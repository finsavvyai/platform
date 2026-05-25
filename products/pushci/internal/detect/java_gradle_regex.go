package detect

import "regexp"

// Compiled up front so repeated parses don't recompile regexes.
var (
	reGroovyComment = regexp.MustCompile(`(?m)//[^\n]*`)
	reBlockComment  = regexp.MustCompile(`(?s)/\*.*?\*/`)
	rePluginID      = regexp.MustCompile(`id\s*\(?\s*["']([^"']+)["']`)
	reKotlinPlugin  = regexp.MustCompile(`kotlin\s*\(\s*["']([^"']+)["']\s*\)`)
	reJavaToolchain = regexp.MustCompile(`JavaLanguageVersion\.of\s*\(\s*(\d+)\s*\)`)
	reSourceCompat  = regexp.MustCompile(`(?:sourceCompatibility|targetCompatibility)\s*=?\s*(?:JavaVersion\.VERSION_)?["']?(\d+)`)
	reGroupField    = regexp.MustCompile(`(?m)^\s*group\s*(?:=|:)?\s*["']([^"']+)["']`)
	reVersionField  = regexp.MustCompile(`(?m)^\s*version\s*(?:=|:)?\s*["']([^"']+)["']`)
	rePluginsBlock  = regexp.MustCompile(`\bplugins\s*\{`)
	reSettingsInc   = regexp.MustCompile(`(?m)\binclude\b\s*\(?\s*([^)\n]+)\)?`)
	reQuoted        = regexp.MustCompile(`["']([^"']+)["']`)
)
