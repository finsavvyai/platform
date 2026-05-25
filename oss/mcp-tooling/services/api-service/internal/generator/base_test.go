package generator

import (
	"testing"

	"github.com/mcpoverflow/api-service/internal/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBaseGenerator_NewBaseGenerator(t *testing.T) {
	features := []Feature{FeatureBasicGeneration, FeatureTypeGeneration}
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", features)

	assert.NotNil(t, gen)
	assert.Equal(t, "typescript", gen.GetLanguage())
	assert.Equal(t, "cloudflare-worker", gen.GetRuntime())
	assert.Equal(t, "1.0.0", gen.GetVersion())
	assert.Equal(t, features, gen.GetSupportedFeatures())
}

func TestBaseGenerator_HasFeature(t *testing.T) {
	features := []Feature{FeatureBasicGeneration, FeatureTypeGeneration}
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", features)

	assert.True(t, gen.HasFeature(FeatureBasicGeneration))
	assert.True(t, gen.HasFeature(FeatureTypeGeneration))
	assert.False(t, gen.HasFeature(FeatureStreaming))
}

func TestBaseGenerator_GetTemplateEngine(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	engine := gen.GetTemplateEngine()
	assert.NotNil(t, engine)
}

func TestBaseGenerator_ValidateNilIR(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	result, err := gen.Validate(nil)
	require.NoError(t, err)
	assert.False(t, result.Valid)
	assert.Len(t, result.Errors, 1)
	assert.Equal(t, "nil_ir", result.Errors[0].Code)
}

func TestBaseGenerator_ValidateEmptyEndpoints(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{},
	}

	result, err := gen.Validate(ir)
	require.NoError(t, err)
	assert.False(t, result.Valid)
	assert.Len(t, result.Errors, 1)
	assert.Equal(t, "no_endpoints", result.Errors[0].Code)
}

func TestBaseGenerator_ValidateMissingMetadata(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			// Missing name and version
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "test",
				Method: "GET",
				Path:   "/test",
			},
		},
	}

	result, err := gen.Validate(ir)
	require.NoError(t, err)
	assert.True(t, result.Valid) // Warnings don't make it invalid
	assert.Len(t, result.Warnings, 2)
}

func TestBaseGenerator_ValidateMissingMethod(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:   "test",
				Path: "/test",
				// Missing method
			},
		},
	}

	result, err := gen.Validate(ir)
	require.NoError(t, err)
	assert.False(t, result.Valid)
	assert.Greater(t, len(result.Errors), 0)
}

func TestBaseGenerator_ValidateStreaming(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration})

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "test",
				Method: "GET",
				Path:   "/stream",
				Streaming: &parser.StreamingInfo{
					Type: "server-stream",
				},
			},
		},
	}

	result, err := gen.Validate(ir)
	require.NoError(t, err)
	assert.True(t, result.Valid) // Warnings don't invalidate
	assert.Contains(t, result.UnsupportedFeatures, FeatureStreaming)
	assert.Greater(t, len(result.Warnings), 0)
}

func TestBaseGenerator_ValidateWebSocket(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration})

	ir := &parser.IntermediateRepresentation{
		Metadata: parser.APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:     "test",
				Method: "GET",
				Path:   "/ws",
				Extensions: map[string]interface{}{
					"protocol": "websocket",
				},
			},
		},
	}

	result, err := gen.Validate(ir)
	require.NoError(t, err)
	assert.True(t, result.Valid)
	assert.Contains(t, result.UnsupportedFeatures, FeatureWebSockets)
}

func TestBaseGenerator_CreateGeneratedCode(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", []Feature{FeatureBasicGeneration})

	files := []GeneratedFile{
		{
			Path:    "index.ts",
			Content: "export default {}",
			Type:    FileTypeSource,
		},
	}

	deps := []Dependency{
		{
			Name:    "@cloudflare/workers-types",
			Version: "^4.0.0",
			Type:    DependencyTypeDev,
		},
	}

	stats := GenerationStatistics{
		TotalFiles:     1,
		TotalLines:     1,
		TotalEndpoints: 5,
		TotalTypes:     3,
	}

	code := gen.CreateGeneratedCode(files, deps, stats)

	assert.NotNil(t, code)
	assert.Equal(t, "typescript", code.Language)
	assert.Equal(t, "cloudflare-worker", code.Runtime)
	assert.Len(t, code.Files, 1)
	assert.Len(t, code.Dependencies, 1)
	assert.Equal(t, 1, code.Metadata.Statistics.TotalFiles)
}

func TestBaseGenerator_CountLines(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	files := []GeneratedFile{
		{
			Path:    "file1.ts",
			Content: "line1\nline2\nline3",
			Type:    FileTypeSource,
		},
		{
			Path:    "file2.ts",
			Content: "line1\nline2",
			Type:    FileTypeSource,
		},
	}

	count := gen.CountLines(files)
	assert.Equal(t, 5, count)
}

func TestBaseGenerator_CountLinesEmpty(t *testing.T) {
	gen := NewBaseGenerator("typescript", "cloudflare-worker", "1.0.0", nil)

	files := []GeneratedFile{
		{
			Path:    "empty.ts",
			Content: "",
			Type:    FileTypeSource,
		},
	}

	count := gen.CountLines(files)
	assert.Equal(t, 0, count)
}

func TestExtractEndpointsByTag(t *testing.T) {
	ir := &parser.IntermediateRepresentation{
		Endpoints: []parser.UnifiedEndpoint{
			{
				ID:   "endpoint1",
				Tags: []string{"users"},
			},
			{
				ID:   "endpoint2",
				Tags: []string{"users", "admin"},
			},
			{
				ID: "endpoint3",
				// No tags
			},
		},
	}

	byTag := ExtractEndpointsByTag(ir)

	assert.Len(t, byTag["users"], 2)
	assert.Len(t, byTag["admin"], 1)
	assert.Len(t, byTag["default"], 1)
}

func TestExtractAuthSchemesByType(t *testing.T) {
	ir := &parser.IntermediateRepresentation{
		Auth: []parser.AuthScheme{
			{
				Type: "apiKey",
				Name: "api_key",
			},
			{
				Type: "oauth2",
				Name: "oauth",
			},
			{
				Type: "apiKey",
				Name: "another_key",
			},
		},
	}

	byType := ExtractAuthSchemesByType(ir)

	assert.Len(t, byType["apiKey"], 2)
	assert.Len(t, byType["oauth2"], 1)
}

func TestGetPrimaryServer(t *testing.T) {
	tests := []struct {
		name     string
		ir       *parser.IntermediateRepresentation
		expected string
	}{
		{
			name: "with servers",
			ir: &parser.IntermediateRepresentation{
				Servers: []parser.ServerConfig{
					{URL: "https://api.production.com"},
					{URL: "https://api.staging.com"},
				},
			},
			expected: "https://api.production.com",
		},
		{
			name: "without servers",
			ir: &parser.IntermediateRepresentation{
				Servers: []parser.ServerConfig{},
			},
			expected: "https://api.example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetPrimaryServer(tt.ir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestNeedsAuthentication(t *testing.T) {
	tests := []struct {
		name     string
		ir       *parser.IntermediateRepresentation
		expected bool
	}{
		{
			name: "with auth schemes",
			ir: &parser.IntermediateRepresentation{
				Auth: []parser.AuthScheme{
					{Type: "apiKey"},
				},
			},
			expected: true,
		},
		{
			name: "with endpoint auth",
			ir: &parser.IntermediateRepresentation{
				Endpoints: []parser.UnifiedEndpoint{
					{
						Auth: []string{"bearer"},
					},
				},
			},
			expected: true,
		},
		{
			name: "no auth",
			ir: &parser.IntermediateRepresentation{
				Auth:      []parser.AuthScheme{},
				Endpoints: []parser.UnifiedEndpoint{},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := NeedsAuthentication(tt.ir)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestHasStreamingEndpoints(t *testing.T) {
	tests := []struct {
		name     string
		ir       *parser.IntermediateRepresentation
		expected bool
	}{
		{
			name: "with streaming",
			ir: &parser.IntermediateRepresentation{
				Endpoints: []parser.UnifiedEndpoint{
					{
						Streaming: &parser.StreamingInfo{
							Type: "server-stream",
						},
					},
				},
			},
			expected: true,
		},
		{
			name: "no streaming",
			ir: &parser.IntermediateRepresentation{
				Endpoints: []parser.UnifiedEndpoint{
					{
						Streaming: nil,
					},
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HasStreamingEndpoints(tt.ir)
			assert.Equal(t, tt.expected, result)
		})
	}
}
