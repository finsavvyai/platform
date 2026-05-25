package runner

import "github.com/finsavvyai/pushci/internal/detect"

// checksForProject returns build+test commands for a project.
func checksForProject(p detect.Project) []check {
	switch p.Stack {
	case detect.Go:
		return goChecks()
	case detect.Node:
		return nodeChecks(p)
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
	}
	return nil
}

func goChecks() []check {
	return []check{
		{"build", "go", []string{"build", "./..."}},
		{"test", "go", []string{"test", "./..."}},
	}
}

func rustChecks() []check {
	return []check{
		{"build", "cargo", []string{"build"}},
		{"test", "cargo", []string{"test"}},
	}
}

func csharpChecks() []check {
	return []check{
		{"build", "dotnet", []string{"build"}},
		{"test", "dotnet", []string{"test"}},
	}
}

func rubyChecks() []check {
	return []check{
		{"install", "bundle", []string{"install"}},
		{"test", "bundle", []string{"exec", "rspec"}},
	}
}

func phpChecks() []check {
	return []check{
		{"install", "composer", []string{"install", "--no-interaction"}},
		{"test", "vendor/bin/phpunit", nil},
	}
}

func swiftChecks() []check {
	return []check{
		{"build", "swift", []string{"build"}},
		{"test", "swift", []string{"test"}},
	}
}

func elixirChecks() []check {
	return []check{
		{"deps", "mix", []string{"deps.get"}},
		{"test", "mix", []string{"test"}},
	}
}
