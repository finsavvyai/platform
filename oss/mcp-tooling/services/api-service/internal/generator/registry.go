package generator

import (
	"context"
	"fmt"
	"sync"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// Registry manages registered code generators
type Registry struct {
	generators map[string]CodeGenerator
	mu         sync.RWMutex
}

var (
	globalRegistry *Registry
	registryOnce   sync.Once
)

// GlobalRegistry returns the global generator registry
func GlobalRegistry() *Registry {
	registryOnce.Do(func() {
		globalRegistry = NewRegistry()
	})
	return globalRegistry
}

// NewRegistry creates a new generator registry
func NewRegistry() *Registry {
	return &Registry{
		generators: make(map[string]CodeGenerator),
	}
}

// Register registers a code generator
func (r *Registry) Register(generator CodeGenerator) error {
	if generator == nil {
		return fmt.Errorf("generator cannot be nil")
	}

	language := generator.GetLanguage()
	runtime := generator.GetRuntime()
	if language == "" {
		return fmt.Errorf("generator must have a language")
	}
	if runtime == "" {
		return fmt.Errorf("generator must have a runtime")
	}

	key := makeKey(language, runtime)

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.generators[key]; exists {
		return fmt.Errorf("generator for language=%s runtime=%s already registered", language, runtime)
	}

	r.generators[key] = generator
	return nil
}

// Get retrieves a generator by language and runtime
func (r *Registry) Get(language, runtime string) (CodeGenerator, error) {
	key := makeKey(language, runtime)

	r.mu.RLock()
	defer r.mu.RUnlock()

	generator, exists := r.generators[key]
	if !exists {
		return nil, fmt.Errorf("no generator found for language=%s runtime=%s", language, runtime)
	}

	return generator, nil
}

// List returns all registered generators
func (r *Registry) List() []GeneratorInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	infos := make([]GeneratorInfo, 0, len(r.generators))
	for _, generator := range r.generators {
		infos = append(infos, GeneratorInfo{
			Language: generator.GetLanguage(),
			Runtime:  generator.GetRuntime(),
			Version:  generator.GetVersion(),
			Features: generator.GetSupportedFeatures(),
		})
	}

	return infos
}

// FindCompatible finds compatible generators for the given IR
func (r *Registry) FindCompatible(ctx context.Context, ir *parser.IntermediateRepresentation) ([]GeneratorInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	compatible := make([]GeneratorInfo, 0)

	for _, generator := range r.generators {
		result, err := generator.Validate(ir)
		if err != nil {
			continue
		}

		if result.Valid {
			compatible = append(compatible, GeneratorInfo{
				Language: generator.GetLanguage(),
				Runtime:  generator.GetRuntime(),
				Version:  generator.GetVersion(),
				Features: generator.GetSupportedFeatures(),
			})
		}
	}

	if len(compatible) == 0 {
		return nil, fmt.Errorf("no compatible generators found for source format: %s", ir.Source.Format)
	}

	return compatible, nil
}

// Generate generates code using the specified generator
func (r *Registry) Generate(ctx context.Context, language, runtime string, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	generator, err := r.Get(language, runtime)
	if err != nil {
		return nil, err
	}

	// Validate before generating
	result, err := generator.Validate(ir)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	if !result.Valid {
		return nil, fmt.Errorf("IR is not valid for this generator: %d errors", len(result.Errors))
	}

	// Generate code
	return generator.Generate(ctx, ir, opts)
}

// Unregister removes a generator from the registry
func (r *Registry) Unregister(language, runtime string) error {
	key := makeKey(language, runtime)

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.generators[key]; !exists {
		return fmt.Errorf("no generator found for language=%s runtime=%s", language, runtime)
	}

	delete(r.generators, key)
	return nil
}

// Clear removes all generators from the registry
func (r *Registry) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.generators = make(map[string]CodeGenerator)
}

// Count returns the number of registered generators
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.generators)
}

// makeKey creates a registry key from language and runtime
func makeKey(language, runtime string) string {
	return fmt.Sprintf("%s:%s", language, runtime)
}

// Convenience functions for global registry

// Register registers a generator in the global registry
func Register(generator CodeGenerator) error {
	return GlobalRegistry().Register(generator)
}

// Get retrieves a generator from the global registry
func Get(language, runtime string) (CodeGenerator, error) {
	return GlobalRegistry().Get(language, runtime)
}

// List returns all registered generators from the global registry
func List() []GeneratorInfo {
	return GlobalRegistry().List()
}

// FindCompatible finds compatible generators in the global registry
func FindCompatible(ctx context.Context, ir *parser.IntermediateRepresentation) ([]GeneratorInfo, error) {
	return GlobalRegistry().FindCompatible(ctx, ir)
}

// Generate generates code using the global registry
func Generate(ctx context.Context, language, runtime string, ir *parser.IntermediateRepresentation, opts GenerateOptions) (*GeneratedCode, error) {
	return GlobalRegistry().Generate(ctx, language, runtime, ir, opts)
}
