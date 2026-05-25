package detect

// markers maps file names to stack + build tool.
//
// Note: Node lockfiles (pnpm-lock.yaml, yarn.lock, bun.lockb,
// package-lock.json) deliberately NOT listed here. They're signals of
// which package manager to USE — not signals of distinct projects.
// DetectNodeBuildTool walks outward from a package.json to find the
// nearest lockfile and derive the tool from that. Keeping lockfiles in
// the marker table caused the opensyber dogfood bug where a single
// workspace produced 77 stages.
var markers = []struct {
	file  string
	stack Stack
	tool  BuildTool
}{
	{"go.mod", Go, ""},
	{"go.work", Go, ""},
	{"package.json", Node, ToolNpm},
	{"requirements.txt", Python, ToolPip},
	{"pyproject.toml", Python, ToolPoetry},
	{"Pipfile", Python, ToolPip},
	{"setup.py", Python, ToolPip},
	{"pytest.ini", Python, ToolPip},
	{"tox.ini", Python, ToolPip},
	{"conftest.py", Python, ToolPip},
	{"Cargo.toml", Rust, ToolCargo},
	{"pom.xml", Java, ToolMaven},
	{"build.gradle", Java, ToolGradle},
	{"build.gradle.kts", Java, ToolGradle},
	{"settings.gradle", Java, ToolGradle},
	{"settings.gradle.kts", Java, ToolGradle},
	{"*.csproj", CSharp, ToolDotnet},
	{"*.sln", CSharp, ToolDotnet},
	{"Gemfile", Ruby, ToolBundler},
	{"composer.json", PHP, ToolComposer},
	{"Package.swift", Swift, ""},
	{"pubspec.yaml", Dart, ""},
	{"mix.exs", Elixir, ToolMix},
	{"Dockerfile", Docker, ""},
	{"docker-compose.yml", Docker, ""},
	{"main.bicep", Bicep, ""},
	{"*.bicep", Bicep, ""},
}
