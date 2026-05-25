package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// extCheckCommands returns build/test/lint for stacks beyond the core six.
func extCheckCommands(root string, stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.PHP] {
		test = append(test, config.Check{Name: "php-test", Run: "vendor/bin/phpunit"})
		lint = append(lint, config.Check{Name: "php-lint", Run: "php -l src/"})
	}
	if stacks[detect.Swift] {
		build = append(build, config.Check{Name: "swift-build", Run: "swift build"})
		test = append(test, config.Check{Name: "swift-test", Run: "swift test"})
	}
	if stacks[detect.Dart] {
		db, dt, dl := dartCheckCommands(projects)
		build = append(build, db...)
		test = append(test, dt...)
		lint = append(lint, dl...)
	}
	if stacks[detect.Elixir] {
		build = append(build, config.Check{Name: "mix-build", Run: "mix compile"})
		test = append(test, config.Check{Name: "mix-test", Run: "mix test"})
		lint = append(lint, config.Check{Name: "mix-format", Run: "mix format --check-formatted"})
	}
	if stacks[detect.Cpp] {
		cb, ct := cppCheckCommands(projects)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	if stacks[detect.Scala] {
		build = append(build, config.Check{Name: "sbt-build", Run: "sbt compile"})
		test = append(test, config.Check{Name: "sbt-test", Run: "sbt test"})
	}
	if stacks[detect.CSharp] {
		cb, ct := dotnetCheckCommands(projects)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	if stacks[detect.Haskell] {
		hb, ht := haskellCheckCommands(projects)
		build = append(build, hb...)
		test = append(test, ht...)
	}
	if stacks[detect.Zig] {
		build = append(build, config.Check{Name: "zig-build", Run: "zig build"})
		test = append(test, config.Check{Name: "zig-test", Run: "zig build test"})
	}
	if stacks[detect.Deno] {
		test = append(test, config.Check{Name: "deno-test", Run: "deno test"})
		lint = append(lint, config.Check{Name: "deno-lint", Run: "deno lint"})
	}
	if stacks[detect.Clojure] {
		cb, ct := allClojureChecks(root, projects)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	return
}

// dartCheckCommands returns Flutter or plain Dart checks.
func dartCheckCommands(projects []detect.Project) (build, test, lint []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Dart && p.Framework == "flutter" {
			test = append(test, config.Check{Name: "flutter-test", Run: "flutter test"})
			lint = append(lint, config.Check{Name: "flutter-analyze", Run: "flutter analyze"})
			return
		}
	}
	test = append(test, config.Check{Name: "dart-test", Run: "dart test"})
	lint = append(lint, config.Check{Name: "dart-lint", Run: "dart analyze"})
	return
}

// cppCheckCommands returns CMake or Make checks.
func cppCheckCommands(projects []detect.Project) (build, test []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Cpp && p.BuildTool == detect.ToolCMake {
			return []config.Check{{Name: "cmake-build", Run: "cmake --build build"}},
				[]config.Check{{Name: "ctest", Run: "ctest --test-dir build"}}
		}
	}
	return []config.Check{{Name: "make-build", Run: "make"}},
		[]config.Check{{Name: "make-test", Run: "make test"}}
}

// haskellCheckCommands returns Stack or Cabal checks.
func haskellCheckCommands(projects []detect.Project) (build, test []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Haskell && p.BuildTool == detect.ToolCabal {
			return []config.Check{{Name: "cabal-build", Run: "cabal build"}},
				[]config.Check{{Name: "cabal-test", Run: "cabal test"}}
		}
	}
	return []config.Check{{Name: "stack-build", Run: "stack build"}},
		[]config.Check{{Name: "stack-test", Run: "stack test"}}
}
