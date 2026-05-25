package detect

// Stack, BuildTool, and Project type definitions.

// Stack represents a detected project technology.
type Stack string

const (
	Go        Stack = "go"
	Node      Stack = "node"
	Python    Stack = "python"
	Rust      Stack = "rust"
	Java      Stack = "java"
	CSharp    Stack = "csharp"
	Ruby      Stack = "ruby"
	PHP       Stack = "php"
	Swift     Stack = "swift"
	Dart      Stack = "dart"
	Elixir    Stack = "elixir"
	Docker    Stack = "docker"
	Cpp       Stack = "cpp"
	Scala     Stack = "scala"
	Clojure   Stack = "clojure"
	Zig       Stack = "zig"
	Deno      Stack = "deno"
	Gleam     Stack = "gleam"
	Haskell   Stack = "haskell"
	Kotlin    Stack = "kotlin"
	Lua       Stack = "lua"
	Perl      Stack = "perl"
	R         Stack = "r"
	Julia     Stack = "julia"
	OCaml     Stack = "ocaml"
	Nim       Stack = "nim"
	Crystal   Stack = "crystal"
	Erlang    Stack = "erlang"
	Vlang     Stack = "vlang"
	Terraform Stack = "terraform"
	Helm      Stack = "helm"
	Solidity  Stack = "solidity"
	Bun       Stack = "bun"
	Fortran   Stack = "fortran"
	Bicep     Stack = "bicep"
)

// BuildTool identifies the package/build manager.
type BuildTool string

const (
	ToolMaven    BuildTool = "maven"
	ToolGradle   BuildTool = "gradle"
	ToolNpm      BuildTool = "npm"
	ToolPnpm     BuildTool = "pnpm"
	ToolYarn     BuildTool = "yarn"
	ToolBun      BuildTool = "bun"
	ToolPip      BuildTool = "pip"
	ToolPoetry   BuildTool = "poetry"
	ToolCargo    BuildTool = "cargo"
	ToolDotnet   BuildTool = "dotnet"
	ToolBundler  BuildTool = "bundler"
	ToolComposer BuildTool = "composer"
	ToolMix      BuildTool = "mix"
	ToolCMake    BuildTool = "cmake"
	ToolMake     BuildTool = "make"
	ToolSbt      BuildTool = "sbt"
	ToolStack    BuildTool = "stack"
	ToolCabal    BuildTool = "cabal"
	ToolLuarocks BuildTool = "luarocks"
	ToolCpanm    BuildTool = "cpanm"
	ToolDune     BuildTool = "dune"
	ToolNimble   BuildTool = "nimble"
	ToolShards   BuildTool = "shards"
	ToolRebar    BuildTool = "rebar3"
	ToolHelm     BuildTool = "helm"
	ToolFoundry  BuildTool = "foundry"
	ToolHardhat  BuildTool = "hardhat"
	ToolFpm      BuildTool = "fpm"
	// Clojure build tools. A `project.clj` repo defaults to ToolLein
	// (Leiningen — the classic build tool), a `deps.edn` repo to
	// ToolClojureCLI (the modern tools.deps CLI), a `bb.edn` repo to
	// ToolBabashka (scripting runtime), a `shadow-cljs.edn` repo to
	// ToolShadowCLJS (ClojureScript), and a `build.boot` repo to
	// ToolBoot. When multiple markers appear in the same dir, the
	// primary build tool is picked by priority in DetectClojure.
	ToolClojureCLI BuildTool = "clj"
	ToolLein       BuildTool = "lein"
	ToolBabashka   BuildTool = "bb"
	ToolShadowCLJS BuildTool = "shadow-cljs"
	ToolBoot       BuildTool = "boot"
)

// Project holds detected info about a service in the repo.
type Project struct {
	Stack     Stack
	BuildTool BuildTool
	Framework string // e.g. "nextjs", "django", "spring-boot"
	Dir       string // relative path from repo root
}
