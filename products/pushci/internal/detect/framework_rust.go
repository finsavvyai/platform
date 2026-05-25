package detect

import "path/filepath"

// detectRustFramework checks Cargo.toml for known Rust frameworks.
func detectRustFramework(base string) string {
	cargo := filepath.Join(base, "Cargo.toml")
	switch {
	case fileContains(cargo, "actix-web"):
		return "actix"
	case fileContains(cargo, "axum"):
		return "axum"
	case fileContains(cargo, "rocket"):
		return "rocket"
	case fileContains(cargo, "tauri"):
		return "tauri"
	case fileContains(cargo, "leptos"):
		return "leptos"
	}
	return ""
}
