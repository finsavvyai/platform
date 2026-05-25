package heal

import (
	"regexp"
	"strings"
)

// strategy is a function that inspects output and returns a Fix or nil.
type strategy func(output string) *Fix

// allStrategies returns all pattern-based fix strategies.
func allStrategies() []strategy {
	return []strategy{
		missingDep,
		missingNodeDep,
		missingPyDep,
		fmtError,
		lockfileOutdated,
		permissionDenied,
		portInUse,
	}
}

func missingDep(output string) *Fix {
	if !strings.Contains(output, "no required module provides") &&
		!strings.Contains(output, "module not found") {
		return nil
	}
	return &Fix{
		Pattern: "go-missing-dep",
		Action:  "go mod tidy",
	}
}

func missingNodeDep(output string) *Fix {
	if !strings.Contains(output, "Cannot find module") &&
		!strings.Contains(output, "MODULE_NOT_FOUND") {
		return nil
	}
	return &Fix{
		Pattern: "node-missing-dep",
		Action:  "npm install",
	}
}

func missingPyDep(output string) *Fix {
	if !strings.Contains(output, "ModuleNotFoundError") &&
		!strings.Contains(output, "No module named") {
		return nil
	}
	return &Fix{
		Pattern: "python-missing-dep",
		Action:  "pip install -r requirements.txt",
	}
}

func fmtError(output string) *Fix {
	if strings.Contains(output, "gofmt") || strings.Contains(output, "goimports") {
		return &Fix{Pattern: "go-fmt", Action: "go fmt ./..."}
	}
	if strings.Contains(output, "prettier") && strings.Contains(output, "Check") {
		return &Fix{Pattern: "prettier-fmt", Action: "npx prettier --write ."}
	}
	return nil
}

func lockfileOutdated(output string) *Fix {
	if strings.Contains(output, "go.sum is out of sync") ||
		strings.Contains(output, "please update go.sum") {
		return &Fix{Pattern: "go-lockfile", Action: "go mod tidy"}
	}
	if strings.Contains(output, "npm warn") && strings.Contains(output, "package-lock") {
		return &Fix{Pattern: "npm-lockfile", Action: "npm install --package-lock-only"}
	}
	return nil
}

func permissionDenied(output string) *Fix {
	if !strings.Contains(output, "permission denied") {
		return nil
	}
	re := regexp.MustCompile(`permission denied[:\s]+['"]?([^\s'"]+)`)
	file := "./script.sh"
	if m := re.FindStringSubmatch(output); len(m) > 1 {
		file = m[1]
	}
	return &Fix{Pattern: "permission-denied", Action: "chmod +x " + file, FilesChanged: []string{file}}
}

func portInUse(output string) *Fix {
	if !strings.Contains(output, "address already in use") {
		return nil
	}
	re := regexp.MustCompile(`:(\d{4,5})`)
	port := "8080"
	if m := re.FindStringSubmatch(output); len(m) > 1 {
		port = m[1]
	}
	return &Fix{Pattern: "port-in-use", Action: "fuser -k " + port + "/tcp"}
}
