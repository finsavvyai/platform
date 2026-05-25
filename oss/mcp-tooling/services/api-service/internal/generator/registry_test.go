package generator

import (
	"context"
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockGenerator is a mock generator for testing
type MockGenerator struct {
	language string
	runtime  string
	version  string
	features []Feature
	valid    bool
}

func NewMockGenerator(language, runtime, version string, features []Feature, valid bool) *MockGenerator {
	return &MockGenerator{
		language: language,
		runtime:  runtime,
		version:  version,
		features: features,
		valid:    valid,
	}
}

func (g *MockGenerator) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	return &GeneratedCode{
		Language: g.language,
		Runtime:  g.runtime,
		Files: []GeneratedFile{
			{
				Path:    "main.ts",
				Content: "// Generated code",
				Type:    FileTypeSource,
			},
		},
		Metadata: GenerationMetadata{
			GeneratorName:    g.language + "-" + g.runtime,
			GeneratorVersion: g.version,
		},
	}, nil
}

func (g *MockGenerator) GetLanguage() string {
	return g.language
}

func (g *MockGenerator) GetRuntime() string {
	return g.runtime
}

func (g *MockGenerator) GetVersion() string {
	return g.version
}

func (g *MockGenerator) Validate(ir *parser.IntermediateRepresentation) (*ValidationResult, error) {
	return &ValidationResult{
		Valid:             g.valid,
		Errors:            []ValidationError{},
		Warnings:          []ValidationError{},
		SupportedFeatures: g.features,
	}, nil
}

func (g *MockGenerator) GetSupportedFeatures() []Feature {
	return g.features
}

func TestRegistry_Register(t *testing.T) {
	registry := NewRegistry()

	gen := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)

	err := registry.Register(gen)
	require.NoError(t, err)

	assert.Equal(t, 1, registry.Count())
}

func TestRegistry_RegisterDuplicate(t *testing.T) {
	registry := NewRegistry()

	gen1 := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	gen2 := NewMockGenerator("typescript", "cloudflare-worker", "2.0.0", []Feature{FeatureBasicGeneration}, true)

	err := registry.Register(gen1)
	require.NoError(t, err)

	err = registry.Register(gen2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already registered")
}

func TestRegistry_RegisterNil(t *testing.T) {
	registry := NewRegistry()

	err := registry.Register(nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot be nil")
}

func TestRegistry_Get(t *testing.T) {
	registry := NewRegistry()

	gen := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	err := registry.Register(gen)
	require.NoError(t, err)

	retrieved, err := registry.Get("typescript", "cloudflare-worker")
	require.NoError(t, err)
	assert.Equal(t, "typescript", retrieved.GetLanguage())
	assert.Equal(t, "cloudflare-worker", retrieved.GetRuntime())
}

func TestRegistry_GetNotFound(t *testing.T) {
	registry := NewRegistry()

	_, err := registry.Get("python", "lambda")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no generator found")
}

func TestRegistry_List(t *testing.T) {
	registry := NewRegistry()

	gen1 := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	gen2 := NewMockGenerator("python", "lambda", "1.0.0", []Feature{FeatureBasicGeneration}, true)

	require.NoError(t, registry.Register(gen1))
	require.NoError(t, registry.Register(gen2))

	infos := registry.List()
	assert.Len(t, infos, 2)

	languages := make(map[string]bool)
	for _, info := range infos {
		languages[info.Language] = true
	}

	assert.True(t, languages["typescript"])
	assert.True(t, languages["python"])
}

func TestRegistry_FindCompatible(t *testing.T) {
	registry := NewRegistry()

	gen1 := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	gen2 := NewMockGenerator("python", "lambda", "1.0.0", []Feature{FeatureBasicGeneration}, false) // Not valid

	require.NoError(t, registry.Register(gen1))
	require.NoError(t, registry.Register(gen2))

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "test",
				Method: "GET",
				Path:   "/test",
			},
		},
	}

	compatible, err := registry.FindCompatible(context.Background(), ir)
	require.NoError(t, err)
	assert.Len(t, compatible, 1)
	assert.Equal(t, "typescript", compatible[0].Language)
}

func TestRegistry_Generate(t *testing.T) {
	registry := NewRegistry()

	gen := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	require.NoError(t, registry.Register(gen))

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "test",
				Method: "GET",
				Path:   "/test",
			},
		},
	}

	code, err := registry.Generate(context.Background(), "typescript", "cloudflare-worker", ir, GenerateOptions{})
	require.NoError(t, err)
	assert.NotNil(t, code)
	assert.Equal(t, "typescript", code.Language)
	assert.Equal(t, "cloudflare-worker", code.Runtime)
	assert.Len(t, code.Files, 1)
}

func TestRegistry_Unregister(t *testing.T) {
	registry := NewRegistry()

	gen := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	require.NoError(t, registry.Register(gen))

	assert.Equal(t, 1, registry.Count())

	err := registry.Unregister("typescript", "cloudflare-worker")
	require.NoError(t, err)

	assert.Equal(t, 0, registry.Count())
}

func TestRegistry_UnregisterNotFound(t *testing.T) {
	registry := NewRegistry()

	err := registry.Unregister("typescript", "cloudflare-worker")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no generator found")
}

func TestRegistry_Clear(t *testing.T) {
	registry := NewRegistry()

	gen1 := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)
	gen2 := NewMockGenerator("python", "lambda", "1.0.0", []Feature{FeatureBasicGeneration}, true)

	require.NoError(t, registry.Register(gen1))
	require.NoError(t, registry.Register(gen2))

	assert.Equal(t, 2, registry.Count())

	registry.Clear()
	assert.Equal(t, 0, registry.Count())
}

func TestGlobalRegistry(t *testing.T) {
	// Clear global registry before test
	GlobalRegistry().Clear()

	gen := NewMockGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration}, true)

	err := Register(gen)
	require.NoError(t, err)

	retrieved, err := Get("typescript", "cloudflare-worker")
	require.NoError(t, err)
	assert.Equal(t, "typescript", retrieved.GetLanguage())

	infos := List()
	assert.GreaterOrEqual(t, len(infos), 1)

	// Cleanup
	GlobalRegistry().Clear()
}

func TestMakeKey(t *testing.T) {
	tests := []struct {
		language string
		runtime  string
		expected string
	}{
		{"typescript", "cloudflare-worker", "typescript:cloudflare-worker"},
		{"python", "lambda", "python:lambda"},
		{"rust", "wasm", "rust:wasm"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			key := makeKey(tt.language, tt.runtime)
			assert.Equal(t, tt.expected, key)
		})
	}
}
