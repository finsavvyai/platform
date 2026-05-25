package heal

import "strings"

// strategy is a function that inspects output and returns a Fix or nil.
type strategy func(output string) *Fix

// allStrategies returns all pattern-based fix strategies.
func allStrategies() []strategy {
	s := []strategy{
		missingDep,
		missingNodeDep,
		missingPyDep,
		fmtError,
		lockfileOutdated,
		permissionDenied,
		portInUse,
		flakyTest,
		timeoutFix,
	}
	s = append(s, d1Strategies()...)
	s = append(s, wranglerStrategies()...)
	s = append(s, tsStrategies()...)
	s = append(s, fileSizeStrategies()...)
	s = append(s, graphStrategies()...)
	return s
}

func missingDep(output string) *Fix {
	if !strings.Contains(output, "no required module provides") &&
		!strings.Contains(output, "module not found") {
		return nil
	}
	return &Fix{Pattern: "go-missing-dep", Action: "go mod tidy"}
}

func missingNodeDep(output string) *Fix {
	if !strings.Contains(output, "Cannot find module") &&
		!strings.Contains(output, "MODULE_NOT_FOUND") {
		return nil
	}
	return &Fix{Pattern: "node-missing-dep", Action: "npm install"}
}

func missingPyDep(output string) *Fix {
	if !strings.Contains(output, "ModuleNotFoundError") &&
		!strings.Contains(output, "No module named") {
		return nil
	}
	return &Fix{Pattern: "python-missing-dep", Action: "pip install -r requirements.txt"}
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
