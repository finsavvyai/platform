package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// ext2CheckCommands returns build/test/lint for OCaml, Nim, Crystal, Erlang, Vlang.
func ext2CheckCommands(stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.OCaml] {
		build = append(build, config.Check{Name: "dune-build", Run: "dune build"})
		test = append(test, config.Check{Name: "dune-test", Run: "dune runtest"})
	}
	if stacks[detect.Nim] {
		build = append(build, config.Check{Name: "nimble-build", Run: "nimble build"})
		test = append(test, config.Check{Name: "nimble-test", Run: "nimble test"})
	}
	if stacks[detect.Crystal] {
		build = append(build, config.Check{Name: "crystal-build", Run: "shards build"})
		test = append(test, config.Check{Name: "crystal-test", Run: "crystal spec"})
		lint = append(lint, config.Check{Name: "crystal-format", Run: "crystal tool format --check"})
	}
	if stacks[detect.Erlang] {
		eb, et, el := erlangCheckCommands(projects)
		build = append(build, eb...)
		test = append(test, et...)
		lint = append(lint, el...)
	}
	if stacks[detect.Vlang] {
		build = append(build, config.Check{Name: "v-build", Run: "v ."})
		test = append(test, config.Check{Name: "v-test", Run: "v test ."})
		lint = append(lint, config.Check{Name: "v-fmt", Run: "v fmt -verify ."})
	}
	return
}

// erlangCheckCommands returns rebar3 or make checks for Erlang.
func erlangCheckCommands(projects []detect.Project) (build, test, lint []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Erlang && p.BuildTool == detect.ToolRebar {
			return []config.Check{{Name: "rebar3-compile", Run: "rebar3 compile"}},
				[]config.Check{{Name: "rebar3-eunit", Run: "rebar3 eunit"}},
				[]config.Check{{Name: "rebar3-dialyzer", Run: "rebar3 dialyzer"}}
		}
	}
	return []config.Check{{Name: "erlang-build", Run: "make"}},
		[]config.Check{{Name: "erlang-test", Run: "make test"}},
		nil
}
