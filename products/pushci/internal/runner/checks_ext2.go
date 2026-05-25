package runner

import "github.com/finsavvyai/pushci/internal/detect"

// ocamlChecks returns checks for OCaml projects.
func ocamlChecks() []check {
	return []check{
		{"build", "dune", []string{"build"}},
		{"test", "dune", []string{"runtest"}},
	}
}

// nimChecks returns checks for Nim projects.
func nimChecks() []check {
	return []check{
		{"build", "nimble", []string{"build"}},
		{"test", "nimble", []string{"test"}},
	}
}

// crystalChecks returns checks for Crystal projects.
func crystalChecks() []check {
	return []check{
		{"build", "shards", []string{"build"}},
		{"test", "crystal", []string{"spec"}},
		{"lint", "crystal", []string{"tool", "format", "--check"}},
	}
}

// erlangChecks returns checks for Erlang projects.
func erlangChecks(p detect.Project) []check {
	if p.BuildTool == detect.ToolRebar {
		return []check{
			{"build", "rebar3", []string{"compile"}},
			{"test", "rebar3", []string{"eunit"}},
			{"lint", "rebar3", []string{"dialyzer"}},
		}
	}
	return []check{
		{"build", "make", nil},
		{"test", "make", []string{"test"}},
	}
}

// vlangChecks returns checks for V (vlang) projects.
func vlangChecks() []check {
	return []check{
		{"build", "v", []string{"."}},
		{"test", "v", []string{"test", "."}},
		{"lint", "v", []string{"fmt", "-verify", "."}},
	}
}
