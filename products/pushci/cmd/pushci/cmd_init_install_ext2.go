package main

import "github.com/finsavvyai/pushci/internal/detect"

// ext2InstallCommands returns install commands for OCaml, Nim, Crystal, Erlang.
func ext2InstallCommands(stacks map[detect.Stack]bool) []string {
	var cmds []string
	if stacks[detect.OCaml] {
		cmds = append(cmds, "opam install . --deps-only")
	}
	if stacks[detect.Nim] {
		cmds = append(cmds, "nimble install -d")
	}
	if stacks[detect.Crystal] {
		cmds = append(cmds, "shards install")
	}
	if stacks[detect.Erlang] {
		cmds = append(cmds, "rebar3 get-deps")
	}
	return cmds
}
