package runner

import "github.com/finsavvyai/pushci/internal/detect"

// cppChecks returns checks for C/C++ projects.
func cppChecks(p detect.Project) []check {
	if p.BuildTool == detect.ToolCMake {
		return []check{
			{"build", "cmake", []string{"--build", "."}},
			{"test", "ctest", nil},
		}
	}
	return []check{
		{"build", "make", nil},
		{"test", "make", []string{"test"}},
	}
}

// scalaChecks returns checks for Scala projects.
func scalaChecks() []check {
	return []check{
		{"build", "sbt", []string{"compile"}},
		{"test", "sbt", []string{"test"}},
	}
}

// haskellChecks returns checks for Haskell projects.
func haskellChecks(p detect.Project) []check {
	if p.BuildTool == detect.ToolCabal {
		return []check{
			{"build", "cabal", []string{"build"}},
			{"test", "cabal", []string{"test"}},
		}
	}
	return []check{
		{"build", "stack", []string{"build"}},
		{"test", "stack", []string{"test"}},
	}
}

// zigChecks returns checks for Zig projects.
func zigChecks() []check {
	return []check{
		{"build", "zig", []string{"build"}},
		{"test", "zig", []string{"build", "test"}},
	}
}

// denoChecks returns checks for Deno projects.
func denoChecks() []check {
	return []check{
		{"check", "deno", []string{"check", "."}},
		{"test", "deno", []string{"test"}},
	}
}

// gleamChecks returns checks for Gleam projects.
func gleamChecks() []check {
	return []check{
		{"build", "gleam", []string{"build"}},
		{"test", "gleam", []string{"test"}},
	}
}

// clojureChecks returns checks for Clojure projects.
func clojureChecks() []check {
	return []check{
		{"install", "lein", []string{"deps"}},
		{"test", "lein", []string{"test"}},
	}
}
