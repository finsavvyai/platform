package generator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTemplateEngine_RegisterTemplate(t *testing.T) {
	engine := NewTemplateEngine()

	err := engine.RegisterTemplate("test", "Hello {{.Name}}")
	require.NoError(t, err)

	assert.True(t, engine.HasTemplate("test"))
}

func TestTemplateEngine_RegisterInvalidTemplate(t *testing.T) {
	engine := NewTemplateEngine()

	err := engine.RegisterTemplate("test", "Hello {{.Name")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse template")
}

func TestTemplateEngine_Execute(t *testing.T) {
	engine := NewTemplateEngine()

	err := engine.RegisterTemplate("test", "Hello {{.Name}}")
	require.NoError(t, err)

	result, err := engine.Execute("test", map[string]string{"Name": "World"})
	require.NoError(t, err)
	assert.Equal(t, "Hello World", result)
}

func TestTemplateEngine_ExecuteNotFound(t *testing.T) {
	engine := NewTemplateEngine()

	_, err := engine.Execute("nonexistent", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestTemplateEngine_ListTemplates(t *testing.T) {
	engine := NewTemplateEngine()

	require.NoError(t, engine.RegisterTemplate("template1", "content1"))
	require.NoError(t, engine.RegisterTemplate("template2", "content2"))

	templates := engine.ListTemplates()
	assert.Len(t, templates, 2)
	assert.Contains(t, templates, "template1")
	assert.Contains(t, templates, "template2")
}

func TestTemplateEngine_CamelCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello_world", "helloWorld"},
		{"HelloWorld", "helloWorld"},
		{"hello-world", "helloWorld"},
		{"hello world", "helloWorld"},
		{"HELLO_WORLD", "helloWorld"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toCamelCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_PascalCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello_world", "HelloWorld"},
		{"helloWorld", "HelloWorld"},
		{"hello-world", "HelloWorld"},
		{"hello world", "HelloWorld"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toPascalCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_SnakeCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"helloWorld", "hello_world"},
		{"HelloWorld", "hello_world"},
		{"hello-world", "hello_world"},
		{"hello world", "hello_world"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toSnakeCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_KebabCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"helloWorld", "hello-world"},
		{"HelloWorld", "hello-world"},
		{"hello_world", "hello-world"},
		{"hello world", "hello-world"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toKebabCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_ScreamCase(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"helloWorld", "HELLO_WORLD"},
		{"HelloWorld", "HELLO_WORLD"},
		{"hello-world", "HELLO_WORLD"},
		{"hello world", "HELLO_WORLD"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := toScreamCase(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_TypeConversion(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		tsType   string
		pyType   string
		rustType string
		goType   string
	}{
		{
			name:     "string",
			input:    "string",
			tsType:   "string",
			pyType:   "str",
			rustType: "String",
			goType:   "string",
		},
		{
			name:     "integer",
			input:    "integer",
			tsType:   "number",
			pyType:   "int",
			rustType: "i64",
			goType:   "int64",
		},
		{
			name:     "boolean",
			input:    "boolean",
			tsType:   "boolean",
			pyType:   "bool",
			rustType: "bool",
			goType:   "bool",
		},
		{
			name:     "array",
			input:    "array",
			tsType:   "Array<any>",
			pyType:   "List[Any]",
			rustType: "Vec<Value>",
			goType:   "[]interface{}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.tsType, typeToTypeScript(tt.input))
			assert.Equal(t, tt.pyType, typeToPython(tt.input))
			assert.Equal(t, tt.rustType, typeToRust(tt.input))
			assert.Equal(t, tt.goType, typeToGo(tt.input))
		})
	}
}

func TestTemplateEngine_Indent(t *testing.T) {
	input := "line1\nline2\nline3"
	expected := "  line1\n  line2\n  line3"

	result := indent(2, input)
	assert.Equal(t, expected, result)
}

func TestTemplateEngine_Comment(t *testing.T) {
	tests := []struct {
		language string
		expected string
	}{
		{"typescript", "// test"},
		{"javascript", "// test"},
		{"go", "// test"},
		{"rust", "// test"},
		{"python", "# test"},
		{"ruby", "# test"},
	}

	for _, tt := range tests {
		t.Run(tt.language, func(t *testing.T) {
			result := comment(tt.language, "test")
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTemplateEngine_Quote(t *testing.T) {
	assert.Equal(t, "'test'", quote("test"))
	assert.Equal(t, "\"test\"", doubleQuote("test"))
	assert.Equal(t, "`test`", backtick("test"))
}

func TestTemplateEngine_WithFunctions(t *testing.T) {
	engine := NewTemplateEngine()

	template := `{{camelCase .Name}} {{pascalCase .Name}} {{snakeCase .Name}}`
	err := engine.RegisterTemplate("test", template)
	require.NoError(t, err)

	result, err := engine.Execute("test", map[string]string{"Name": "hello_world"})
	require.NoError(t, err)
	assert.Equal(t, "helloWorld HelloWorld hello_world", result)
}

func TestTemplateEngine_CustomFunction(t *testing.T) {
	engine := NewTemplateEngine()

	// Add custom function
	engine.AddFunc("reverse", func(s string) string {
		runes := []rune(s)
		for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
			runes[i], runes[j] = runes[j], runes[i]
		}
		return string(runes)
	})

	template := `{{reverse .Text}}`
	err := engine.RegisterTemplate("test", template)
	require.NoError(t, err)

	result, err := engine.Execute("test", map[string]string{"Text": "hello"})
	require.NoError(t, err)
	assert.Equal(t, "olleh", result)
}

func TestTemplateEngine_TypeHelpers(t *testing.T) {
	engine := NewTemplateEngine()

	template := `{{typeToTS .Type}} {{typeToPython .Type}} {{typeToRust .Type}} {{typeToGo .Type}}`
	err := engine.RegisterTemplate("test", template)
	require.NoError(t, err)

	result, err := engine.Execute("test", map[string]string{"Type": "string"})
	require.NoError(t, err)
	assert.Equal(t, "string str String string", result)
}

func TestSplitByDelimiters(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"helloWorld", []string{"hello", "world"}},
		{"hello_world", []string{"hello", "world"}},
		{"hello-world", []string{"hello", "world"}},
		{"hello world", []string{"hello", "world"}},
		{"HelloWorld", []string{"hello", "world"}},
		{"HELLO_WORLD", []string{"hello", "world"}},
		{"hello.world", []string{"hello", "world"}},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := splitByDelimiters(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
