package heal

import (
	"fmt"
	"strings"
)

// tsPropertyNotExist detects property-does-not-exist errors.
func tsPropertyNotExist(output string) *Fix {
	m := reTSProperty.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	return &Fix{
		Pattern: "ts-property-missing",
		Action:  fmt.Sprintf("echo 'Property %s not on type %s — update interface or use optional chaining'", m[1], m[2]),
	}
}

// tsTypeNotAssignable detects type mismatch errors.
func tsTypeNotAssignable(output string) *Fix {
	m := reTSNotAssignable.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	return &Fix{
		Pattern: "ts-type-mismatch",
		Action:  fmt.Sprintf("echo 'Type mismatch: %s is not assignable to %s'", m[1], m[2]),
	}
}

// tsMissingExport detects missing exported members.
func tsMissingExport(output string) *Fix {
	m := reTSMissingExport.FindStringSubmatch(output)
	if m == nil {
		return nil
	}
	return &Fix{
		Pattern: "ts-missing-export",
		Action:  fmt.Sprintf("echo 'Module %s has no export %s — check import name'", m[1], m[2]),
	}
}

// extractPackageName gets the npm package name from a module path.
func extractPackageName(mod string) string {
	if strings.HasPrefix(mod, "@") {
		parts := strings.SplitN(mod, "/", 3)
		if len(parts) >= 2 {
			return parts[0] + "/" + parts[1]
		}
	}
	parts := strings.SplitN(mod, "/", 2)
	return parts[0]
}
