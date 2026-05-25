package runner

// Core runtime checks for Go, Rust, C#, Ruby, PHP, Swift, Elixir.

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
