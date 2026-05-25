package integrate

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// intExtChecks returns build/test/lint for extended stacks.
func intExtChecks(stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.PHP] {
		test = append(test, config.Check{Name: "php-test", Run: "vendor/bin/phpunit"})
		lint = append(lint, config.Check{Name: "php-lint", Run: "php -l src/"})
	}
	if stacks[detect.Swift] {
		build = append(build, config.Check{Name: "swift-build", Run: "swift build"})
		test = append(test, config.Check{Name: "swift-test", Run: "swift test"})
	}
	if stacks[detect.Dart] {
		dt, dl := intDartChecks(projects)
		test = append(test, dt...)
		lint = append(lint, dl...)
	}
	if stacks[detect.Elixir] {
		build = append(build, config.Check{Name: "mix-build", Run: "mix compile"})
		test = append(test, config.Check{Name: "mix-test", Run: "mix test"})
		lint = append(lint, config.Check{Name: "mix-format", Run: "mix format --check-formatted"})
	}
	if stacks[detect.Cpp] {
		cb, ct := intCppChecks(projects)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	if stacks[detect.Scala] {
		build = append(build, config.Check{Name: "sbt-build", Run: "sbt compile"})
		test = append(test, config.Check{Name: "sbt-test", Run: "sbt test"})
	}
	if stacks[detect.CSharp] {
		build = append(build, config.Check{Name: "dotnet-build", Run: "dotnet build"})
		test = append(test, config.Check{Name: "dotnet-test", Run: "dotnet test"})
	}
	if stacks[detect.Haskell] {
		hb, ht := intHaskellChecks(projects)
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
		cb, ct := intAllClojureChecks(projects)
		build = append(build, cb...)
		test = append(test, ct...)
	}
	if stacks[detect.Gleam] {
		build = append(build, config.Check{Name: "gleam-build", Run: "gleam build"})
		test = append(test, config.Check{Name: "gleam-test", Run: "gleam test"})
	}
	return
}

// intCppChecks returns CMake or Make checks.
func intCppChecks(projects []detect.Project) ([]config.Check, []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Cpp && p.BuildTool == detect.ToolCMake {
			return []config.Check{{Name: "cmake-build", Run: "cmake --build build"}},
				[]config.Check{{Name: "ctest", Run: "ctest --test-dir build"}}
		}
	}
	return []config.Check{{Name: "make-build", Run: "make"}},
		[]config.Check{{Name: "make-test", Run: "make test"}}
}

// intDartChecks returns Flutter or plain Dart checks.
func intDartChecks(projects []detect.Project) (test, lint []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Dart && p.Framework == "flutter" {
			return []config.Check{{Name: "flutter-test", Run: "flutter test"}},
				[]config.Check{{Name: "flutter-analyze", Run: "flutter analyze"}}
		}
	}
	return []config.Check{{Name: "dart-test", Run: "dart test"}},
		[]config.Check{{Name: "dart-lint", Run: "dart analyze"}}
}

// intHaskellChecks returns Stack or Cabal checks.
func intHaskellChecks(projects []detect.Project) ([]config.Check, []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Haskell && p.BuildTool == detect.ToolCabal {
			return []config.Check{{Name: "cabal-build", Run: "cabal build"}},
				[]config.Check{{Name: "cabal-test", Run: "cabal test"}}
		}
	}
	return []config.Check{{Name: "stack-build", Run: "stack build"}},
		[]config.Check{{Name: "stack-test", Run: "stack test"}}
}
