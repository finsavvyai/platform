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
		// Kotlin (standalone)
		{"*.kt", Kotlin, ""},
		// Lua
		{"*.lua", Lua, ""},
		{".busted", Lua, ToolLuarocks},
		// Perl
		{"Makefile.PL", Perl, ToolCpanm},
		{"Build.PL", Perl, ToolCpanm},
		{"cpanfile", Perl, ToolCpanm},
		{"dist.ini", Perl, ToolCpanm},
		// R
		{".Rproj", R, ""},
		{"renv.lock", R, ""},
		// Julia
		{"Project.toml", Julia, ""},
		// OCaml
		{"dune-project", OCaml, ToolDune},
		{"*.opam", OCaml, ToolDune},
		{"_oasis", OCaml, ""},
		// Nim
		{"*.nimble", Nim, ToolNimble},
		// Crystal
		{"shard.yml", Crystal, ToolShards},
		// Erlang
		{"rebar.config", Erlang, ToolRebar},
		{"rebar.lock", Erlang, ToolRebar},
		{"erlang.mk", Erlang, ToolMake},
		// V (vlang)
		{"v.mod", Vlang, ""},
		// IaC tools (non-Terraform)
		{"Pulumi.yaml", Docker, ""},
		{"template.yaml", Docker, ""},
		{"template.yml", Docker, ""},
		{"ansible.cfg", Docker, ""},
		// Terraform / OpenTofu
		{"*.tf", Terraform, ""},
		{"terraform.tfvars", Terraform, ""},
		{".terraform.lock.hcl", Terraform, ""},
		// Helm
		{"Chart.yaml", Helm, ToolHelm},
		// Solidity / Foundry / Hardhat
		{"foundry.toml", Solidity, ToolFoundry},
		{"hardhat.config.js", Solidity, ToolHardhat},
		{"hardhat.config.ts", Solidity, ToolHardhat},
		{"truffle-config.js", Solidity, ToolHardhat},
		// Bun (first-class runtime)
		{"bun.lockb", Bun, ToolBun},
		{"bunfig.toml", Bun, ToolBun},
		// Fortran
		{"fpm.toml", Fortran, ToolFpm},
	}...)
}
