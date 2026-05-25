// Package detect — Python dependency-name matching.
//
// Bug D (global-remit v1.6.4 dogfood): detectPythonDeps used
// strings.Contains on requirements.txt / pyproject.toml, so a
// dep named `fastapi-users` or a URL comment mentioning fastapi
// caused a false-positive fastapi framework tag. Mirrors the
// strong-signal Spring-Boot approach in framework_java.go.
//
// hasPyDep returns true only if `name` appears as the literal
// dependency name — at the start of a requirements line, or
// quoted/keyed in pyproject.toml — not as a substring of some
// other package or inside a URL/comment.

package detect

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// pyDepRegex builds a regex that matches `name` as a literal
// dependency name in either requirements.txt or pyproject.toml.
// Anchors accepted before the name:
//   - start of line
//   - quote, bracket, comma, or equals (TOML / PEP 621 list)
//
// Anchors accepted after the name:
//   - end of line, whitespace, extras `[...]`, version op
//     (== < > ~ != ;), quote, or TOML `=`/comma
func pyDepRegex(name string) *regexp.Regexp {
	q := regexp.QuoteMeta(name)
	pat := `(?im)(?:^|[\s"',\[=])` + q + `(?:\[[^\]]+\])?(?:$|[\s"'<>=~!;,\]])`
	return regexp.MustCompile(pat)
}

// hasPyDep checks whether any Python manifest in base declares a
// dependency named literally `name` (case-insensitive).
func hasPyDep(base, name string) bool {
	re := pyDepRegex(name)
	for _, f := range []string{"requirements.txt", "pyproject.toml", "Pipfile", "setup.py"} {
		data, err := os.ReadFile(filepath.Join(base, f))
		if err != nil {
			continue
		}
		body := stripComments(string(data), f)
		if re.MatchString(body) {
			return true
		}
	}
	return false
}

// stripComments removes `#`-style comments from requirements.txt /
// Pipfile / pyproject.toml lines so a URL or comment mentioning a
// framework name cannot trigger a false positive.
func stripComments(s, filename string) string {
	if strings.HasSuffix(filename, ".py") {
		return s
	}
	var b strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if i := strings.Index(line, "#"); i >= 0 {
			line = line[:i]
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String()
}
