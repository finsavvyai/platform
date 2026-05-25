package detect

// Extended markers for additional stacks and build tools.
// Appended to markers in init().

func init() {
	markers = append(markers, []struct {
		file  string
		stack Stack
		tool  BuildTool
	}{
		// C/C++
		{"CMakeLists.txt", Cpp, ToolCMake},
		{"Makefile", Cpp, ToolMake},
		// Scala
		{"build.sbt", Scala, ToolSbt},
		// Clojure
		{"project.clj", Clojure, ""},
		// Zig
		{"build.zig", Zig, ""},
		// Deno
		{"deno.json", Deno, ""},
		{"deno.jsonc", Deno, ""},
		// Haskell
		{"stack.yaml", Haskell, ToolStack},
		{"cabal.project", Haskell, ToolCabal},
		// Gleam
		{"gleam.toml", Gleam, ""},
		// Command/task runners (detected as Node monorepo tools)
		{"turbo.json", Node, ToolNpm},
		{"nx.json", Node, ToolNpm},
		// Platform markers (detected as Docker for deploy context)
		{"Justfile", Docker, ""},
		{"Taskfile.yml", Docker, ""},
		{"Earthfile", Docker, ""},
		{"Tiltfile", Docker, ""},
		{"Procfile", Docker, ""},
		{"fly.toml", Docker, ""},
		{"render.yaml", Docker, ""},
		{"railway.json", Docker, ""},
		{"vercel.json", Docker, ""},
		// PureScript
		{"spago.dhall", Haskell, ""},
		// IaC tools
		{"*.tf", Docker, ""},
		{"Pulumi.yaml", Docker, ""},
		{"template.yaml", Docker, ""},
		{"template.yml", Docker, ""},
		{"ansible.cfg", Docker, ""},
	}...)
}
