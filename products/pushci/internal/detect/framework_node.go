package detect

// detectNodePkgFramework checks package.json for framework deps.
func detectNodePkgFramework(pkg string) string {
	switch {
	case fileContains(pkg, "create-t3-app"):
		return "t3"
	case fileContains(pkg, "\"expo\""):
		return "expo"
	case fileContains(pkg, "\"electron\""):
		return "electron"
	case fileContains(pkg, "\"hono\""):
		return "hono"
	case fileContains(pkg, "\"elysia\""):
		return "elysia"
	case fileContains(pkg, "\"react-scripts\""):
		return "cra"
	case fileContains(pkg, "\"angular\""):
		return "angular"
	case fileContains(pkg, "\"vue\""):
		return "vue"
	case fileContains(pkg, "\"vite\""):
		return "vite"
	}
	return ""
}
