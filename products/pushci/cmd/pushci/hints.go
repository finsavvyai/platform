package main

import "strings"

type hint struct {
	pattern string
	fix     string
}

var hintPatterns = []hint{
	// Node / npm
	{"No test files found", "Add test files matching your vitest/jest include pattern, or remove the test check"},
	{"missing script: build", "Add \"build\" script to package.json, or configure vite.config.ts with lib entry"},
	{"Cannot find module", "Run: npm install"},
	{"MODULE_NOT_FOUND", "Run: npm install"},
	{"command not found: tsc", "Run: npm install -D typescript"},
	{"command not found: vitest", "Run: npm install -D vitest"},
	{"command not found: jest", "Run: npm install -D jest"},
	{"command not found: eslint", "Run: npm install -D eslint"},
	{"ERR_MODULE_NOT_FOUND", "Run: npm install"},
	{"missing script: build", "Add \"build\" script to package.json"},
	{"missing script: test", "Add \"test\" script to package.json"},
	{"TS2307", "Missing type declarations — run: npm install -D @types/<pkg>"},
	{"TS2345", "TypeScript type mismatch — check function argument types"},
	{"TS2322", "TypeScript type mismatch — check assignment types"},
	{"TS18046", "Variable is possibly undefined — add null check"},
	{"error TS", "TypeScript errors — run: npx tsc --noEmit to see details"},
	{"ENOENT: no such file", "Missing file — check paths in config"},
	{"Could not resolve entry module", "Vite/Rollup can't find entry — check lib.entry in vite.config.ts"},
	{"buildApp", "Vite build failed — check vite.config.ts and entry points"},
	{"npm ERR! code ERESOLVE", "Dependency conflict — run: npm install --legacy-peer-deps"},

	// Python
	{"No module named", "Run: pip install -r requirements.txt"},
	{"ModuleNotFoundError", "Run: pip install -r requirements.txt"},
	{"command not found: pip", "Install Python: https://python.org or brew install python"},
	{"command not found: python", "Install Python: https://python.org or brew install python"},
	{"SyntaxError", "Python syntax error — check the file mentioned above"},

	// Go
	{"does not match go tool version", "Go version mismatch — your go.mod requires a newer Go than you have installed. Run: brew upgrade go"},
	{"cannot find package", "Run: go mod tidy"},
	{"go: module", "Run: go mod download"},
	{"undefined:", "Go compilation error — check missing imports or typos"},
	{"go: updates to go.sum needed", "Run: go mod tidy"},
	{"build constraints exclude all Go files", "No Go files match the build tags for this platform"},

	// Java / Kotlin
	{"BUILD FAILURE", "Check Maven/Gradle config and dependencies"},
	{"command not found: mvn", "Install Maven: brew install maven"},
	{"command not found: gradle", "Install Gradle: brew install gradle"},
	{"Could not resolve dependencies", "Run: mvn dependency:resolve or gradle dependencies"},

	// Rust
	{"error[E", "Rust compiler error — run: cargo check for details"},
	{"command not found: cargo", "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"},

	// Docker
	{"Cannot connect to the Docker daemon", "Start Docker Desktop or run: sudo systemctl start docker"},
	{"command not found: docker", "Install Docker: https://docs.docker.com/get-docker/"},

	// C/C++
	{"command not found: make", "Install build tools: xcode-select --install (macOS) or apt install build-essential (Linux)"},
	{"command not found: cmake", "Install CMake: brew install cmake"},
	{"undefined reference", "C/C++ linker error — check library links (-l flags)"},

	// Generic
	{"permission denied", "Check file permissions — try: chmod +x <file>"},
	{"EACCES", "Permission denied — check file/directory permissions"},
	{"ENOMEM", "Out of memory — close other apps or increase swap"},
	{"ETIMEDOUT", "Network timeout — check internet connection"},
	{"ECONNREFUSED", "Connection refused — is the service running?"},
}

func matchHints(output string) []string {
	lower := strings.ToLower(output)
	seen := map[string]bool{}
	var hints []string
	for _, h := range hintPatterns {
		if strings.Contains(lower, strings.ToLower(h.pattern)) && !seen[h.fix] {
			seen[h.fix] = true
			hints = append(hints, h.fix)
		}
	}
	return hints
}
