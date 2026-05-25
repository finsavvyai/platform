package detect

import "path/filepath"

// detectGoFramework checks go.mod for known Go frameworks.
func detectGoFramework(base string) string {
	mod := filepath.Join(base, "go.mod")
	switch {
	case fileContains(mod, "gin-gonic"):
		return "gin"
	case fileContains(mod, "labstack/echo"):
		return "echo"
	case fileContains(mod, "gofiber"):
		return "fiber"
	case fileContains(mod, "go-chi"):
		return "chi"
	case fileContains(mod, "a-h/templ"):
		return "templ"
	}
	return ""
}
