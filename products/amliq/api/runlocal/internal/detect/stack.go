package detect

// Stack, BuildTool, and Project type definitions.

// Stack represents a detected project technology.
type Stack string

const (
	Go      Stack = "go"
	Node    Stack = "node"
	Python  Stack = "python"
	Rust    Stack = "rust"
	Java    Stack = "java"
	CSharp  Stack = "csharp"
	Ruby    Stack = "ruby"
	PHP     Stack = "php"
	Swift   Stack = "swift"
	Dart    Stack = "dart"
	Elixir  Stack = "elixir"
	Docker  Stack = "docker"
	Cpp     Stack = "cpp"
	Scala   Stack = "scala"
	Clojure Stack = "clojure"
	Zig     Stack = "zig"
	Deno    Stack = "deno"
	Gleam   Stack = "gleam"
	Haskell Stack = "haskell"
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
)

// Project holds detected info about a service in the repo.
type Project struct {
	Stack     Stack
	BuildTool BuildTool
	Framework string // e.g. "nextjs", "django", "spring-boot"
	Dir       string // relative path from repo root
}

// markers maps file names to stack + build tool.
var markers = []struct {
	file  string
	stack Stack
	tool  BuildTool
}{
	{"go.mod", Go, ""},
	{"go.work", Go, ""},
	{"package.json", Node, ToolNpm},
	{"pnpm-lock.yaml", Node, ToolPnpm},
	{"yarn.lock", Node, ToolYarn},
	{"bun.lockb", Node, ToolBun},
	{"requirements.txt", Python, ToolPip},
	{"pyproject.toml", Python, ToolPoetry},
	{"Pipfile", Python, ToolPip},
	{"setup.py", Python, ToolPip},
	{"Cargo.toml", Rust, ToolCargo},
	{"pom.xml", Java, ToolMaven},
	{"build.gradle", Java, ToolGradle},
	{"build.gradle.kts", Java, ToolGradle},
	{"*.csproj", CSharp, ToolDotnet},
	{"*.sln", CSharp, ToolDotnet},
	{"Gemfile", Ruby, ToolBundler},
	{"composer.json", PHP, ToolComposer},
	{"Package.swift", Swift, ""},
	{"pubspec.yaml", Dart, ""},
	{"mix.exs", Elixir, ToolMix},
	{"Dockerfile", Docker, ""},
	{"docker-compose.yml", Docker, ""},
}
