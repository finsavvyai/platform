package runner

import "github.com/finsavvyai/pushci/internal/detect"

// checksForProject returns build+test commands for a project.
// `dir` is the absolute path to the project; Node checks use it
// to read package.json and prefer `<pkgmgr> run <script>` over
// bare-bin `npx <tool>` (which breaks in pnpm workspaces where
// the hoisted bin lives under the package, not the repo root).
func checksForProject(p detect.Project, dir string) []check {
	switch p.Stack {
	case detect.Go:
		return goChecks()
	case detect.Node:
		return nodeChecks(p, dir)
	case detect.Python:
		return pythonChecks(p)
	case detect.Rust:
		return rustChecks()
	case detect.Java:
		return javaChecks(p)
	case detect.CSharp:
		return csharpChecks()
	case detect.Ruby:
		return rubyChecks()
	case detect.PHP:
		return phpChecks()
	case detect.Swift:
		return swiftChecks()
	case detect.Dart:
		return dartChecks(p)
	case detect.Elixir:
		return elixirChecks()
	case detect.Cpp:
		return cppChecks(p)
	case detect.Scala:
		return scalaChecks()
	case detect.Haskell:
		return haskellChecks(p)
	case detect.Zig:
		return zigChecks()
	case detect.Deno:
		return denoChecks()
	case detect.Gleam:
		return gleamChecks()
	case detect.Clojure:
		return clojureChecks()
	case detect.OCaml:
		return ocamlChecks()
	case detect.Nim:
		return nimChecks()
	case detect.Crystal:
		return crystalChecks()
	case detect.Erlang:
		return erlangChecks(p)
	case detect.Vlang:
		return vlangChecks()
	case detect.Kotlin:
		return kotlinChecks()
	case detect.Lua:
		return luaChecks()
	case detect.Perl:
		return perlChecks()
	case detect.R:
		return rChecks()
	case detect.Julia:
		return juliaChecks()
	case detect.Terraform:
		return terraformChecks()
	case detect.Helm:
		return helmChecks()
	case detect.Solidity:
		return solidityChecks(p)
	case detect.Bun:
		return bunChecks()
	case detect.Fortran:
		return fortranChecks()
	}
	return nil
}
