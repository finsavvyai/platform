package migrate

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// tfInterpRE matches Terraform variable / data interpolations:
// `${var.codebuild_name}` or `var.codebuild_name` or `data.aws_x.y.z`.
// We treat any of these as "unresolved at parse time" — the actual
// value lives in *.tfvars or environment-injected TF_VAR_* and the
// emitted PushCI deploy target should not include the literal token.
var tfInterpRE = regexp.MustCompile(`(?:\$\{)?(?:var|data|local)\.[a-zA-Z_][a-zA-Z0-9_.]*\}?`)

// isUnresolvedTFInterp reports whether s is empty or contains only
// (or any) Terraform interpolation tokens — i.e. the value the user
// will see in the generated pushci.yml is meaningless without
// running `terraform apply`.
func isUnresolvedTFInterp(s string) bool {
	if s == "" {
		return true
	}
	return tfInterpRE.MatchString(s)
}

// resolveTFName picks a deploy-safe name for a Terraform-managed
// pipeline. Order:
//  1. `name = "..."` attribute, if static
//  2. tfvars lookup when the attribute references `var.X`
//  3. resource label fallback (always present, always concrete)
func resolveTFName(rawName, dir, label string) string {
	if rawName != "" && !isUnresolvedTFInterp(rawName) {
		return rawName
	}
	if v := lookupTFVarFromDir(rawName, dir); v != "" {
		return v
	}
	return label
}

// lookupTFVarFromDir scans `*.tfvars` under dir for a binding that
// matches the variable referenced by rawName. Best-effort: returns
// "" when the var name can't be parsed or no tfvars file resolves
// it. Picks `terraform.tfvars` first, then any *.tfvars in stable
// alphabetical order — same precedence Terraform itself uses for
// auto-loading.
func lookupTFVarFromDir(rawName, dir string) string {
	m := tfInterpRE.FindString(rawName)
	if m == "" {
		return ""
	}
	m = strings.TrimPrefix(m, "${")
	m = strings.TrimSuffix(m, "}")
	if !strings.HasPrefix(m, "var.") {
		return ""
	}
	key := strings.TrimPrefix(m, "var.")
	files, _ := filepath.Glob(filepath.Join(dir, "*.tfvars"))
	for _, f := range files {
		if v := readTFVar(f, key); v != "" {
			return v
		}
	}
	return ""
}

func readTFVar(path, key string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, key) {
			continue
		}
		eq := strings.Index(line, "=")
		if eq < 0 {
			continue
		}
		val := strings.TrimSpace(line[eq+1:])
		val = strings.Trim(val, `"' `)
		if val != "" {
			return val
		}
	}
	return ""
}
