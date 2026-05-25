package parser

import (
	"context"
	"fmt"
	"sync"
)

// ParserRegistry manages all available parsers and provides format detection
type ParserRegistry struct {
	mu       sync.RWMutex
	parsers  map[string]UniversalParser
	detectors []FormatDetector
}

// NewParserRegistry creates a new parser registry
func NewParserRegistry() *ParserRegistry {
	return &ParserRegistry{
		parsers:   make(map[string]UniversalParser),
		detectors: []FormatDetector{},
	}
}

// Register registers a parser for a specific format
func (r *ParserRegistry) Register(parser UniversalParser) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	format := parser.GetFormat()
	if format == "" {
		return fmt.Errorf("parser format cannot be empty")
	}

	if _, exists := r.parsers[format]; exists {
		return fmt.Errorf("parser for format %s already registered", format)
	}

	r.parsers[format] = parser
	return nil
}

// RegisterDetector registers a format detector
func (r *ParserRegistry) RegisterDetector(detector FormatDetector) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.detectors = append(r.detectors, detector)
}

// Unregister removes a parser from the registry
func (r *ParserRegistry) Unregister(format string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.parsers[format]; !exists {
		return fmt.Errorf("parser for format %s not found", format)
	}

	delete(r.parsers, format)
	return nil
}

// Get retrieves a parser by format
func (r *ParserRegistry) Get(format string) (UniversalParser, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	parser, exists := r.parsers[format]
	if !exists {
		return nil, fmt.Errorf("parser for format %s not found", format)
	}

	return parser, nil
}

// DetectFormat attempts to detect the format of the input
func (r *ParserRegistry) DetectFormat(input []byte) (string, float64, error) {
	r.mu.RLock()
	detectors := make([]FormatDetector, len(r.detectors))
	copy(detectors, r.detectors)
	r.mu.RUnlock()

	if len(detectors) == 0 {
		return "", 0, fmt.Errorf("no format detectors registered")
	}

	bestFormat := ""
	bestConfidence := 0.0

	// Try all detectors and pick the one with highest confidence
	for _, detector := range detectors {
		format, confidence, err := detector.Detect(input)
		if err != nil {
			continue
		}

		if confidence > bestConfidence {
			bestFormat = format
			bestConfidence = confidence
		}
	}

	if bestFormat == "" {
		return "", 0, fmt.Errorf("unable to detect format")
	}

	return bestFormat, bestConfidence, nil
}

// Parse attempts to detect the format and parse the input
func (r *ParserRegistry) Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	// Try to detect format
	format, confidence, err := r.DetectFormat(input)
	if err != nil {
		return nil, fmt.Errorf("format detection failed: %w", err)
	}

	// Get appropriate parser
	parser, err := r.Get(format)
	if err != nil {
		return nil, fmt.Errorf("parser not found for detected format %s: %w", format, err)
	}

	// Parse with detected parser
	ir, err := parser.Parse(ctx, input, opts)
	if err != nil {
		return nil, fmt.Errorf("parsing failed with %s parser (confidence: %.2f): %w", format, confidence, err)
	}

	return ir, nil
}

// ParseWithFormat parses input with a specific format (skips detection)
func (r *ParserRegistry) ParseWithFormat(ctx context.Context, format string, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	parser, err := r.Get(format)
	if err != nil {
		return nil, err
	}

	return parser.Parse(ctx, input, opts)
}

// ListFormats returns all registered format names
func (r *ParserRegistry) ListFormats() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	formats := make([]string, 0, len(r.parsers))
	for format := range r.parsers {
		formats = append(formats, format)
	}
	return formats
}

// GetParserInfo returns information about a registered parser
func (r *ParserRegistry) GetParserInfo(format string) (*ParserInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	parser, exists := r.parsers[format]
	if !exists {
		return nil, fmt.Errorf("parser for format %s not found", format)
	}

	return &ParserInfo{
		Format:            parser.GetFormat(),
		Version:           parser.GetVersion(),
		SupportedVersions: parser.GetSupportedVersions(),
	}, nil
}

// ParserInfo contains information about a parser
type ParserInfo struct {
	Format            string   `json:"format"`
	Version           string   `json:"version"`
	SupportedVersions []string `json:"supported_versions"`
}

// Global registry instance
var globalRegistry = NewParserRegistry()

// GlobalRegistry returns the global parser registry
func GlobalRegistry() *ParserRegistry {
	return globalRegistry
}

// Register registers a parser in the global registry
func Register(parser UniversalParser) error {
	return globalRegistry.Register(parser)
}

// RegisterDetector registers a format detector in the global registry
func RegisterDetector(detector FormatDetector) {
	globalRegistry.RegisterDetector(detector)
}

// Get retrieves a parser from the global registry
func Get(format string) (UniversalParser, error) {
	return globalRegistry.Get(format)
}

// DetectFormat detects format using the global registry
func DetectFormat(input []byte) (string, float64, error) {
	return globalRegistry.DetectFormat(input)
}

// Parse parses input using the global registry
func Parse(ctx context.Context, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	return globalRegistry.Parse(ctx, input, opts)
}

// ParseWithFormat parses input with specific format using the global registry
func ParseWithFormat(ctx context.Context, format string, input []byte, opts ParseOptions) (*IntermediateRepresentation, error) {
	return globalRegistry.ParseWithFormat(ctx, format, input, opts)
}
