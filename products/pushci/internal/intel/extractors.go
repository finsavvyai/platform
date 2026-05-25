package intel

import (
	"regexp"
	"strings"
)

var (
	tsExportRe  = regexp.MustCompile(`export\s+(?:default\s+)?(?:function|const|class|type|interface|enum)\s+(\w+)`)
	goExportRe  = regexp.MustCompile(`^(?:func|type|const|var)\s+([A-Z]\w*)`)
	pyDefRe     = regexp.MustCompile(`^(?:def|class)\s+(\w+)`)
	rsExportRe  = regexp.MustCompile(`^pub\s+(?:fn|struct|enum|trait|type)\s+(\w+)`)
	javaClassRe = regexp.MustCompile(`(?:public|protected)\s+(?:class|interface|enum)\s+(\w+)`)
)

func extractSymbols(line, file, lang string, lineNum int) []Symbol {
	var re *regexp.Regexp
	var kind string

	switch lang {
	case "typescript", "javascript":
		re = tsExportRe
		kind = detectTSKind(line)
	case "go":
		re = goExportRe
		kind = detectGoKind(line)
	case "python":
		re = pyDefRe
		kind = detectPyKind(line)
	case "rust":
		re = rsExportRe
		kind = "function"
	case "java", "kotlin", "csharp":
		re = javaClassRe
		kind = "class"
	default:
		return nil
	}

	if re == nil {
		return nil
	}
	m := re.FindStringSubmatch(line)
	if len(m) > 1 {
		return []Symbol{{Name: m[1], Kind: kind, File: file, Line: lineNum}}
	}
	return nil
}

func detectTSKind(line string) string {
	if strings.Contains(line, "function") {
		return "function"
	}
	if strings.Contains(line, "class") {
		return "class"
	}
	if strings.Contains(line, "type") || strings.Contains(line, "interface") {
		return "type"
	}
	return "const"
}

func detectGoKind(line string) string {
	if strings.HasPrefix(line, "func") {
		return "function"
	}
	if strings.HasPrefix(line, "type") {
		return "type"
	}
	return "const"
}

func detectPyKind(line string) string {
	if strings.HasPrefix(line, "class") {
		return "class"
	}
	return "function"
}

func isComplexityToken(line, lang string) bool {
	switch lang {
	case "go":
		return strings.HasPrefix(line, "if ") || strings.HasPrefix(line, "for ") ||
			strings.HasPrefix(line, "switch ") || strings.HasPrefix(line, "case ")
	case "typescript", "javascript":
		return strings.Contains(line, "if (") || strings.Contains(line, "for (") ||
			strings.Contains(line, "switch (") || strings.Contains(line, "? ") ||
			strings.Contains(line, "catch (")
	case "python":
		return strings.HasPrefix(line, "if ") || strings.HasPrefix(line, "for ") ||
			strings.HasPrefix(line, "elif ") || strings.HasPrefix(line, "except ")
	default:
		return strings.Contains(line, "if ") || strings.Contains(line, "for ")
	}
}
