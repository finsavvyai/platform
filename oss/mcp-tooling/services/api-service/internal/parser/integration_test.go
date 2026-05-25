package parser

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAsyncAPIRegistryIntegration tests that AsyncAPI parser is properly registered
func TestAsyncAPIRegistryIntegration(t *testing.T) {
	// Test that AsyncAPI parser is in global registry
	parser, err := Get("asyncapi")
	require.NoError(t, err, "AsyncAPI parser should be registered in global registry")
	assert.NotNil(t, parser)
	assert.Equal(t, "asyncapi", parser.GetFormat())

	// Test parsing via registry
	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "Registry Test API",
			"version": "1.0.0"
		},
		"channels": {}
	}`

	ctx := context.Background()
	ir, err := ParseWithFormat(ctx, "asyncapi", []byte(asyncapiDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)
	assert.Equal(t, "Registry Test API", ir.Metadata.Title)
	assert.Equal(t, "asyncapi", ir.Source.Format)
}

// TestGRPCRegistryIntegration tests that gRPC parser is properly registered
func TestGRPCRegistryIntegration(t *testing.T) {
	// Test that gRPC parser is in global registry
	parser, err := Get("grpc")
	require.NoError(t, err, "gRPC parser should be registered in global registry")
	assert.NotNil(t, parser)
	assert.Equal(t, "grpc", parser.GetFormat())
}

// TestListRegisteredParsers tests listing all registered parsers
func TestListRegisteredParsers(t *testing.T) {
	formats := GlobalRegistry().ListFormats()

	// Should have at least gRPC, AsyncAPI, OpenHandler, and REST Discovery
	assert.Contains(t, formats, "grpc", "gRPC parser should be registered")
	assert.Contains(t, formats, "asyncapi", "AsyncAPI parser should be registered")
	assert.Contains(t, formats, "openhandler", "OpenHandler parser should be registered")
	assert.Contains(t, formats, "rest-discovery", "REST Discovery parser should be registered")

	t.Logf("Registered parsers: %v", formats)
}

// TestAutoDetectAsyncAPI tests automatic format detection for AsyncAPI
func TestAutoDetectAsyncAPI(t *testing.T) {
	asyncapiDoc := `{
		"asyncapi": "3.0.0",
		"info": {
			"title": "Auto Detect Test",
			"version": "1.0.0"
		},
		"channels": {}
	}`

	format, confidence, err := DetectFormat([]byte(asyncapiDoc))
	require.NoError(t, err)
	assert.Equal(t, "asyncapi", format)
	assert.Greater(t, confidence, 0.0)

	t.Logf("Detected format: %s with confidence: %.2f", format, confidence)
}

// TestOpenHandlerRegistryIntegration tests that OpenHandler parser is properly registered
func TestOpenHandlerRegistryIntegration(t *testing.T) {
	// Test that OpenHandler parser is in global registry
	parser, err := Get("openhandler")
	require.NoError(t, err, "OpenHandler parser should be registered in global registry")
	assert.NotNil(t, parser)
	assert.Equal(t, "openhandler", parser.GetFormat())

	// Test parsing via registry
	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "Registry Test API",
			"version": "1.0.0"
		},
		"handlers": {
			"testHandler": {
				"method": "GET",
				"path": "/test",
				"responses": {
					"200": {"description": "Success"}
				}
			}
		}
	}`

	ctx := context.Background()
	ir, err := ParseWithFormat(ctx, "openhandler", []byte(openhandlerDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)
	assert.Equal(t, "Registry Test API", ir.Metadata.Title)
	assert.Equal(t, "openhandler", ir.Source.Format)
}

// TestAutoDetectOpenHandler tests automatic format detection for OpenHandler
func TestAutoDetectOpenHandler(t *testing.T) {
	openhandlerDoc := `{
		"openhandler": "1.0.0",
		"info": {
			"title": "Auto Detect Test",
			"version": "1.0.0"
		},
		"handlers": {}
	}`

	format, confidence, err := DetectFormat([]byte(openhandlerDoc))
	require.NoError(t, err)
	assert.Equal(t, "openhandler", format)
	assert.Greater(t, confidence, 0.0)

	t.Logf("Detected format: %s with confidence: %.2f", format, confidence)
}

// TestRESTDiscoveryRegistryIntegration tests that REST Discovery parser is properly registered
func TestRESTDiscoveryRegistryIntegration(t *testing.T) {
	// Test that REST Discovery parser is in global registry
	parser, err := Get("rest-discovery")
	require.NoError(t, err, "REST Discovery parser should be registered in global registry")
	assert.NotNil(t, parser)
	assert.Equal(t, "rest-discovery", parser.GetFormat())

	// Test parsing HAL via registry
	halDoc := `{
		"_links": {
			"self": {"href": "/api/test"},
			"next": {"href": "/api/test/2"}
		}
	}`

	ctx := context.Background()
	ir, err := ParseWithFormat(ctx, "rest-discovery", []byte(halDoc), ParseOptions{})
	require.NoError(t, err)
	assert.NotNil(t, ir)
	assert.Equal(t, "HAL API", ir.Metadata.Title)
	assert.Equal(t, "rest-discovery", ir.Source.Format)
}

// TestAutoDetectRESTDiscovery tests automatic format detection for REST Discovery
func TestAutoDetectRESTDiscovery(t *testing.T) {
	halDoc := `{
		"_links": {
			"self": {"href": "/api/test"}
		}
	}`

	format, confidence, err := DetectFormat([]byte(halDoc))
	require.NoError(t, err)
	assert.Equal(t, "rest-discovery", format)
	assert.Greater(t, confidence, 0.0)

	t.Logf("Detected format: %s with confidence: %.2f", format, confidence)
}
