package heal

import (
	"fmt"
	"regexp"
	"strings"
)

var (
	reTSMissingModule = regexp.MustCompile(`Cannot find module '([^']+)'`)
	reTSMissingType   = regexp.MustCompile(`Cannot find name '([^']+)'`)
	reTSProperty      = regexp.MustCompile(`Property '(\w+)' does not exist on type '([^']+)'`)
	reTSNotAssignable = regexp.MustCompile(`Type '([^']+)' is not assignable to type '([^']+)'`)
	reTSMissingExport = regexp.MustCompile(`Module '"([^"]+)"' has no exported member '(\w+)'`)
)

// tsMissingModule detects missing module imports.
func tsMissingModule(output string) *Fix {
	m := reTSMissingModule.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	mod := m[1]
	if strings.HasPrefix(mod, ".") || strings.HasPrefix(mod, "$") {
		return &Fix{
			Pattern: "ts-missing-local-module",
			Action:  fmt.Sprintf("echo 'Missing local module: %s — check path aliases and file existence'", mod),
		}
	}
	pkg := extractPackageName(mod)
	return &Fix{Pattern: "ts-missing-module", Action: "npm install " + pkg}
}

// tsMissingType detects undefined type/name references.
func tsMissingType(output string) *Fix {
	m := reTSMissingType.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	name := m[1]
	knownTypes := map[string]string{
		"JSX": "@types/react", "React": "@types/react",
		"NodeJS": "@types/node", "RequestInit": "@types/node",
		"Response": "@types/node", "HTMLElement": "typescript",
		"DocumentFragment": "typescript",
	}
	if pkg, ok := knownTypes[name]; ok {
		return &Fix{Pattern: "ts-missing-type-package", Action: "npm install -D " + pkg}
	}
	return &Fix{
		Pattern: "ts-missing-name",
		Action:  fmt.Sprintf("echo 'Undefined name: %s — add import or declaration'", name),
	}
}

// tsStrategies returns all TypeScript heal strategies.
func tsStrategies() []strategy {
	return []strategy{
		tsMissingModule, tsMissingType,
		tsPropertyNotExist, tsTypeNotAssignable, tsMissingExport,
	}
}
