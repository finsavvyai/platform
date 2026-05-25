package parser

import (
	"context"
	"testing"
	"time"
)

// MockParser implements UniversalParser for testing
type MockParser struct {
	format            string
	version           string
	supportedVersions []string
}

func (m *MockParser) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	return &IntermediateRepresentation{
		Metadata: APIMetadata{
			Name:    "Test API",
			Version: "1.0.0",
		},
		Source: SourceInfo{
			Format:        m.format,
			ParserVersion: m.version,
			ParsedAt:      time.Now(),
		},
	}, nil
}

func (m *MockParser) DetectFormat(input []byte) (string, error) {
	return m.format, nil
}

func (m *MockParser) Validate(ir *IntermediateRepresentation) (*ValidationResults, error) {
	return &ValidationResults{
		IsValid: true,
	}, nil
}

func (m *MockParser) GetFormat() string {
	return m.format
}

func (m *MockParser) GetVersion() string {
	return m.version
}

func (m *MockParser) GetSupportedVersions() []string {
	return m.supportedVersions
}

// TestParserRegistry tests the parser registry
func TestParserRegistry(t *testing.T) {
	registry := NewParserRegistry()

	// Test registration
	mockParser := &MockParser{
		format:            "test",
		version:           "1.0.0",
		supportedVersions: []string{"1.0.0"},
	}

	err := registry.Register(mockParser)
	if err != nil {
		t.Fatalf("Failed to register parser: %v", err)
	}

	// Test retrieval
	parser, err := registry.Get("test")
	if err != nil {
		t.Fatalf("Failed to get parser: %v", err)
	}

	if parser.GetFormat() != "test" {
		t.Errorf("Expected format 'test', got '%s'", parser.GetFormat())
	}

	// Test duplicate registration
	err = registry.Register(mockParser)
	if err == nil {
		t.Error("Expected error when registering duplicate parser")
	}

	// Test list formats
	formats := registry.ListFormats()
	if len(formats) != 1 || formats[0] != "test" {
		t.Errorf("Expected formats [test], got %v", formats)
	}

	// Test parser info
	info, err := registry.GetParserInfo("test")
	if err != nil {
		t.Fatalf("Failed to get parser info: %v", err)
	}

	if info.Format != "test" || info.Version != "1.0.0" {
		t.Errorf("Unexpected parser info: %+v", info)
	}

	// Test unregister
	err = registry.Unregister("test")
	if err != nil {
		t.Fatalf("Failed to unregister parser: %v", err)
	}

	// Verify unregistered
	_, err = registry.Get("test")
	if err == nil {
		t.Error("Expected error when getting unregistered parser")
	}
}

// TestParseWithFormat tests parsing with a specific format
func TestParseWithFormat(t *testing.T) {
	registry := NewParserRegistry()

	mockParser := &MockParser{
		format:  "test",
		version: "1.0.0",
	}

	registry.Register(mockParser)

	ctx := context.Background()
	input := []byte(`{"test": "data"}`)
	opts := ParseOptions{}

	ir, err := registry.ParseWithFormat(ctx, "test", input, opts)
	if err != nil {
		t.Fatalf("Failed to parse: %v", err)
	}

	if ir.Metadata.Name != "Test API" {
		t.Errorf("Expected 'Test API', got '%s'", ir.Metadata.Name)
	}
}

// TestGlobalRegistry tests the global registry
func TestGlobalRegistry(t *testing.T) {
	// Note: This modifies global state, so use with caution
	mockParser := &MockParser{
		format:  "global-test",
		version: "1.0.0",
	}

	err := Register(mockParser)
	if err != nil {
		t.Fatalf("Failed to register in global registry: %v", err)
	}

	parser, err := Get("global-test")
	if err != nil {
		t.Fatalf("Failed to get from global registry: %v", err)
	}

	if parser.GetFormat() != "global-test" {
		t.Errorf("Expected format 'global-test', got '%s'", parser.GetFormat())
	}

	// Cleanup
	GlobalRegistry().Unregister("global-test")
}
