package main

// Central registry of flag specs for the subcommands we've
// hardened against the unknown-flag-silently-ignored bug (teddk
// dogfood). Each list is the authoritative declaration consumed by
// validateFlags(). When you add a new flag to a handler, add it
// here too — otherwise validateFlags will reject it as unknown.

func initFlagSpecs() []FlagSpec {
	return []FlagSpec{
		{Long: "--force", Aliases: []string{"-f"}},
		{Long: "--install-hooks"},
		{Long: "--non-interactive"},
		{Long: "--yes", Aliases: []string{"-y"}},
	}
}

func migrateFlagSpecs() []FlagSpec {
	return []FlagSpec{
		{Long: "--action", Takes: true},
		{Long: "--composite", Takes: true},
		{Long: "--input", Takes: true},
		{Long: "--output", Aliases: []string{"-o"}, Takes: true},
		{Long: "--write", Aliases: []string{"-w"}},
		{Long: "--force", Aliases: []string{"-f"}},
	}
}
