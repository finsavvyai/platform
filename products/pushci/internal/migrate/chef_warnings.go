package migrate

import "strings"

// chefRunScript returns the shell invocation for a validate-*.sh/py
// helper — python3 for .py, bash for .sh.
func chefRunScript(name string) string {
	if strings.HasSuffix(name, ".py") {
		return "python3 " + name
	}
	return "bash " + name
}

// emitChefWarnings translates layout findings into user-facing warnings.
// Kept separate from buildChefPushCIYAML so the YAML emitter stays pure.
func emitChefWarnings(layout chefLayout, result *ChefConvertResult) {
	for _, cb := range layout.cookbooks {
		if !cb.HasSpec {
			result.Warnings = append(result.Warnings,
				"No ChefSpec specs in cookbook '"+cb.Name+"' — skipped unit-test")
		}
	}
	if layout.foodcritic {
		result.Warnings = append(result.Warnings,
			"foodcritic is deprecated — migrated to cookstyle")
	}
	if !layout.berksfile && !layout.policyfile {
		result.Warnings = append(result.Warnings,
			"No dependency manifest found — deps stage skipped")
	}
	if layout.kitchenYAML == "" {
		result.Warnings = append(result.Warnings,
			"No .kitchen.yml found — integration stage skipped")
	}
	if layout.knifeRef {
		result.Warnings = append(result.Warnings,
			"'knife' references detected in scripts — deprecated pattern, review before running")
	}
}
