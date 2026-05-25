package generator

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"
)

// TemplateEngine handles code generation from templates
type TemplateEngine struct {
	templates map[string]*template.Template
	funcMap   template.FuncMap
}

// NewTemplateEngine creates a new template engine
func NewTemplateEngine() *TemplateEngine {
	return &TemplateEngine{
		templates: make(map[string]*template.Template),
		funcMap:   makeDefaultFuncMap(),
	}
}

// RegisterTemplate registers a template
func (e *TemplateEngine) RegisterTemplate(name, content string) error {
	tmpl, err := template.New(name).Funcs(e.funcMap).Parse(content)
	if err != nil {
		return fmt.Errorf("failed to parse template %s: %w", name, err)
	}

	e.templates[name] = tmpl
	return nil
}

// Execute executes a template with the given data
func (e *TemplateEngine) Execute(name string, data interface{}) (string, error) {
	tmpl, exists := e.templates[name]
	if !exists {
		return "", fmt.Errorf("template %s not found", name)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute template %s: %w", name, err)
	}

	return buf.String(), nil
}

// AddFunc adds a custom function to the template engine
func (e *TemplateEngine) AddFunc(name string, fn interface{}) {
	e.funcMap[name] = fn
}

// HasTemplate checks if a template is registered
func (e *TemplateEngine) HasTemplate(name string) bool {
	_, exists := e.templates[name]
	return exists
}

// ListTemplates returns all registered template names
func (e *TemplateEngine) ListTemplates() []string {
	names := make([]string, 0, len(e.templates))
	for name := range e.templates {
		names = append(names, name)
	}
	return names
}

// makeDefaultFuncMap creates the default function map for templates
func makeDefaultFuncMap() template.FuncMap {
	return template.FuncMap{
		// String functions
		"toLower":      strings.ToLower,
		"toUpper":      strings.ToUpper,
		"title":        strings.Title,
		"trim":         strings.TrimSpace,
		"trimPrefix":   strings.TrimPrefix,
		"trimSuffix":   strings.TrimSuffix,
		"replace":      strings.ReplaceAll,
		"split":        strings.Split,
		"join":         strings.Join,
		"contains":     strings.Contains,
		"hasPrefix":    strings.HasPrefix,
		"hasSuffix":    strings.HasSuffix,

		// Naming conventions
		"camelCase":    toCamelCase,
		"pascalCase":   toPascalCase,
		"snakeCase":    toSnakeCase,
		"kebabCase":    toKebabCase,
		"screamCase":   toScreamCase,

		// Code generation helpers
		"indent":       indent,
		"comment":      comment,
		"quote":        quote,
		"doubleQuote":  doubleQuote,
		"backtick":     backtick,

		// Type helpers
		"typeToTS":     typeToTypeScript,
		"typeToPython": typeToPython,
		"typeToRust":   typeToRust,
		"typeToGo":     typeToGo,

		// Array/slice helpers
		"first":        first,
		"last":         last,
		"join_with":    joinWith,

		// Conditional helpers
		"default":      defaultValue,
		"coalesce":     coalesce,
	}
}

// Naming convention helpers

func toCamelCase(s string) string {
	parts := splitByDelimiters(s)
	if len(parts) == 0 {
		return s
	}

	result := strings.ToLower(parts[0])
	for i := 1; i < len(parts); i++ {
		result += strings.Title(strings.ToLower(parts[i]))
	}
	return result
}

func toPascalCase(s string) string {
	parts := splitByDelimiters(s)
	result := ""
	for _, part := range parts {
		result += strings.Title(strings.ToLower(part))
	}
	return result
}

func toSnakeCase(s string) string {
	parts := splitByDelimiters(s)
	return strings.Join(parts, "_")
}

func toKebabCase(s string) string {
	parts := splitByDelimiters(s)
	return strings.Join(parts, "-")
}

func toScreamCase(s string) string {
	parts := splitByDelimiters(s)
	return strings.ToUpper(strings.Join(parts, "_"))
}

func splitByDelimiters(s string) []string {
	// Split by common delimiters and camelCase
	var parts []string
	var current strings.Builder

	for i, r := range s {
		if r == '_' || r == '-' || r == ' ' || r == '.' {
			if current.Len() > 0 {
				parts = append(parts, strings.ToLower(current.String()))
				current.Reset()
			}
		} else if i > 0 && isUpperCase(r) && !isUpperCase(rune(s[i-1])) {
			if current.Len() > 0 {
				parts = append(parts, strings.ToLower(current.String()))
				current.Reset()
			}
			current.WriteRune(r)
		} else {
			current.WriteRune(r)
		}
	}

	if current.Len() > 0 {
		parts = append(parts, strings.ToLower(current.String()))
	}

	return parts
}

func isUpperCase(r rune) bool {
	return r >= 'A' && r <= 'Z'
}

// Code generation helpers

func indent(spaces int, text string) string {
	indentation := strings.Repeat(" ", spaces)
	lines := strings.Split(text, "\n")
	for i, line := range lines {
		if line != "" {
			lines[i] = indentation + line
		}
	}
	return strings.Join(lines, "\n")
}

func comment(language, text string) string {
	switch language {
	case "typescript", "javascript", "go", "rust", "java":
		return "// " + text
	case "python", "ruby":
		return "# " + text
	default:
		return "// " + text
	}
}

func quote(s string) string {
	return "'" + s + "'"
}

func doubleQuote(s string) string {
	return "\"" + s + "\""
}

func backtick(s string) string {
	return "`" + s + "`"
}

// Type conversion helpers

func typeToTypeScript(t string) string {
	switch t {
	case "string":
		return "string"
	case "number", "integer", "float", "double":
		return "number"
	case "boolean", "bool":
		return "boolean"
	case "array":
		return "Array<any>"
	case "object":
		return "Record<string, any>"
	default:
		return "any"
	}
}

func typeToPython(t string) string {
	switch t {
	case "string":
		return "str"
	case "number", "integer":
		return "int"
	case "float", "double":
		return "float"
	case "boolean", "bool":
		return "bool"
	case "array":
		return "List[Any]"
	case "object":
		return "Dict[str, Any]"
	default:
		return "Any"
	}
}

func typeToRust(t string) string {
	switch t {
	case "string":
		return "String"
	case "number", "integer":
		return "i64"
	case "float", "double":
		return "f64"
	case "boolean", "bool":
		return "bool"
	case "array":
		return "Vec<Value>"
	case "object":
		return "HashMap<String, Value>"
	default:
		return "Value"
	}
}

func typeToGo(t string) string {
	switch t {
	case "string":
		return "string"
	case "number", "integer":
		return "int64"
	case "float", "double":
		return "float64"
	case "boolean", "bool":
		return "bool"
	case "array":
		return "[]interface{}"
	case "object":
		return "map[string]interface{}"
	default:
		return "interface{}"
	}
}

// Array/slice helpers

func first(arr []interface{}) interface{} {
	if len(arr) == 0 {
		return nil
	}
	return arr[0]
}

func last(arr []interface{}) interface{} {
	if len(arr) == 0 {
		return nil
	}
	return arr[len(arr)-1]
}

func joinWith(sep string, arr []string) string {
	return strings.Join(arr, sep)
}

// Conditional helpers

func defaultValue(defaultVal, value interface{}) interface{} {
	if value == nil || value == "" {
		return defaultVal
	}
	return value
}

func coalesce(values ...interface{}) interface{} {
	for _, value := range values {
		if value != nil && value != "" {
			return value
		}
	}
	return nil
}
