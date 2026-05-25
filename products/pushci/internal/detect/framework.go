package detect

import "path/filepath"

// detectFramework sniffs config files to determine the framework.
func detectFramework(root, dir string, stack Stack) string {
	base := filepath.Join(root, dir)

	switch stack {
	case Node:
		return detectNodeFramework(base)
	case Python:
		return detectPythonFramework(base)
	case Java:
		return detectJavaFramework(base)
	case CSharp:
		return detectCSharpFramework(base)
	case Ruby:
		return detectRubyFramework(base)
	case PHP:
		return detectPHPFramework(base)
	case Go:
		return detectGoFramework(base)
	case Rust:
		return detectRustFramework(base)
	case Scala:
		return detectScalaFramework(base)
	case Dart:
		if fileContains(filepath.Join(base, "pubspec.yaml"), "flutter") {
			return "flutter"
		}
	case Elixir:
		if fileContains(filepath.Join(base, "mix.exs"), "phoenix") {
			return "phoenix"
		}
	}
	return ""
}

func detectNodeFramework(base string) string {
	pkg := filepath.Join(base, "package.json")
	switch {
	case fileExists(filepath.Join(base, "next.config.js")),
		fileExists(filepath.Join(base, "next.config.mjs")),
		fileExists(filepath.Join(base, "next.config.ts")):
		return "nextjs"
	case fileExists(filepath.Join(base, "nuxt.config.ts")):
		return "nuxt"
	case fileExists(filepath.Join(base, "svelte.config.js")):
		return "sveltekit"
	case fileExists(filepath.Join(base, "astro.config.mjs")):
		return "astro"
	case fileExists(filepath.Join(base, "gatsby-config.js")):
		return "gatsby"
	case fileExists(filepath.Join(base, "docusaurus.config.js")):
		return "docusaurus"
	case fileExists(filepath.Join(base, ".storybook")):
		return "storybook"
	case fileExists(filepath.Join(base, "turbo.json")):
		return "turborepo"
	}
	return detectNodePkgFramework(pkg)
}
