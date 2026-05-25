package main

import "github.com/finsavvyai/pushci/internal/detect"

// extInstallCommands returns install commands for stacks beyond the core six.
func extInstallCommands(stacks map[detect.Stack]bool) []string {
	var cmds []string
	if stacks[detect.PHP] {
		cmds = append(cmds, "composer install")
	}
	if stacks[detect.Dart] {
		cmds = append(cmds, "dart pub get")
	}
	if stacks[detect.Elixir] {
		cmds = append(cmds, "mix deps.get")
	}
	if stacks[detect.CSharp] {
		cmds = append(cmds, "dotnet restore")
	}
	if stacks[detect.Clojure] {
		// Callers without project detail fall back to Leiningen; the
		// tool-aware path is in cmd_init_clojure.go and overrides this
		// via buildInstallCommandsForProjects.
		cmds = append(cmds, "lein deps")
	}
	if stacks[detect.Lua] {
		cmds = append(cmds, "luarocks install --only-deps")
	}
	if stacks[detect.Perl] {
		cmds = append(cmds, "cpanm --installdeps .")
	}
	if stacks[detect.R] {
		cmds = append(cmds, `Rscript -e "renv::restore()"`)
	}
	if stacks[detect.Julia] {
		cmds = append(cmds, `julia -e "using Pkg; Pkg.instantiate()"`)
	}
	return cmds
}
