package migrate

import "fmt"

// resolveBuildspecEnv walks buildspec `env:` blocks and returns:
//   - a flat map of plain `variables:` suitable for emission as a
//     stage-level env: mapping
//   - human-readable warnings for secrets/parameter-store/exports
//   - structured EnvVarRef entries so the CLI can render the "set this"
//     guidance consistently across every migrator
func resolveBuildspecEnv(env buildspecEnv) (map[string]string, []string, []EnvVarRef) {
	vars := map[string]string{}
	var warnings []string
	var refs []EnvVarRef

	for k, v := range env.Variables {
		vars[k] = v
	}

	for name, ref := range env.SecretsManager {
		warnings = append(warnings,
			fmt.Sprintf("SECRET: %s → pushci secret set %s <value> (from secret %s)", name, name, ref))
		refs = append(refs, EnvVarRef{
			Name: name, Source: "buildspec-secrets-manager", IsSecret: true,
			Suggestion: fmt.Sprintf("pushci secret set %s <value>", name),
		})
	}

	for name, path := range env.ParameterStore {
		warnings = append(warnings,
			fmt.Sprintf("SSM: %s → pushci secret set %s <value> (from SSM parameter %s)", name, name, path))
		refs = append(refs, EnvVarRef{
			Name: name, Source: "buildspec-parameter-store", IsSecret: true,
			Suggestion: fmt.Sprintf("pushci secret set %s <value>", name),
		})
	}

	for _, name := range env.ExportedVariables {
		warnings = append(warnings,
			fmt.Sprintf("exported-variable '%s' — pushci has no cross-stage exports; export via artifact or shared env", name))
	}

	if env.Shell != "" && env.Shell != "bash" && env.Shell != "/bin/bash" {
		warnings = append(warnings,
			fmt.Sprintf("env.shell=%s — pushci defaults to the host shell; adjust shebangs in your scripts", env.Shell))
	}

	if truthy(env.GitCredHelper) {
		warnings = append(warnings,
			"env.git-credential-helper=yes — pushci runs on your machine; existing git credentials are used automatically")
	}

	return vars, warnings, refs
}

// truthy accepts both YAML-native bools (`yes` → true) and the string
// forms CodeBuild accepts for the git-credential-helper toggle.
func truthy(v interface{}) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "yes" || t == "true" || t == "on"
	}
	return false
}
