package integration

import (
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

// loadOpenAPISpec loads the core OpenAPI spec and merges in the extensions spec.
// Both documents must exist; the extension paths/components are overlaid into
// the core document so tests see a single unified view.
func loadOpenAPISpec(t *testing.T) *openapi3.T {
	core := loadSpecFromCandidates(t, []string{
		"api/openapi.yaml",
		"../api/openapi.yaml",
		"../../api/openapi.yaml",
	})
	ext := loadSpecFromCandidates(t, []string{
		"api/openapi-extensions.yaml",
		"../api/openapi-extensions.yaml",
		"../../api/openapi-extensions.yaml",
	})
	mergeSpecs(core, ext)
	return core
}

func loadSpecFromCandidates(t *testing.T, paths []string) *openapi3.T {
	var lastErr error
	for _, path := range paths {
		spec, err := openapi3.NewLoader().LoadFromFile(path)
		if err == nil {
			return spec
		}
		lastErr = err
	}
	t.Fatalf("unable to load OpenAPI spec from %v: %v", paths, lastErr)
	return nil
}

// mergeSpecs overlays paths and components from src onto dst. Entries in src
// win on conflicts, which is intentional: extension files declare the
// canonical definition for their own surface area.
func mergeSpecs(dst, src *openapi3.T) {
	if src == nil {
		return
	}
	if dst.Paths == nil {
		dst.Paths = &openapi3.Paths{}
	}
	if src.Paths != nil {
		for path, item := range src.Paths.Map() {
			dst.Paths.Set(path, item)
		}
	}
	if src.Components == nil {
		return
	}
	if dst.Components == nil {
		dst.Components = &openapi3.Components{}
	}
	if dst.Components.Schemas == nil {
		dst.Components.Schemas = openapi3.Schemas{}
	}
	for k, v := range src.Components.Schemas {
		dst.Components.Schemas[k] = v
	}
	if dst.Components.Parameters == nil {
		dst.Components.Parameters = openapi3.ParametersMap{}
	}
	for k, v := range src.Components.Parameters {
		dst.Components.Parameters[k] = v
	}
	if dst.Components.Responses == nil {
		dst.Components.Responses = openapi3.ResponseBodies{}
	}
	for k, v := range src.Components.Responses {
		dst.Components.Responses[k] = v
	}
	if dst.Components.SecuritySchemes == nil {
		dst.Components.SecuritySchemes = openapi3.SecuritySchemes{}
	}
	for k, v := range src.Components.SecuritySchemes {
		dst.Components.SecuritySchemes[k] = v
	}
}

// getAllPathsWithMethods returns all paths and their HTTP methods from spec.
func getAllPathsWithMethods(spec *openapi3.T) map[string][]string {
	result := make(map[string][]string)

	for path, pathItem := range spec.Paths.Map() {
		var methods []string
		if pathItem.Get != nil {
			methods = append(methods, "GET")
		}
		if pathItem.Post != nil {
			methods = append(methods, "POST")
		}
		if pathItem.Patch != nil {
			methods = append(methods, "PATCH")
		}
		if pathItem.Delete != nil {
			methods = append(methods, "DELETE")
		}
		if pathItem.Put != nil {
			methods = append(methods, "PUT")
		}
		result[path] = methods
	}

	return result
}

// verifyPathExists checks if a path exists in the spec.
func verifyPathExists(spec *openapi3.T, path string) bool {
	return spec.Paths.Find(path) != nil
}

// verifyOperationExists checks if a specific HTTP method exists for a path.
func verifyOperationExists(spec *openapi3.T, path, method string) bool {
	pathItem := spec.Paths.Find(path)
	if pathItem == nil {
		return false
	}

	switch method {
	case "GET":
		return pathItem.Get != nil
	case "POST":
		return pathItem.Post != nil
	case "PATCH":
		return pathItem.Patch != nil
	case "DELETE":
		return pathItem.Delete != nil
	case "PUT":
		return pathItem.Put != nil
	}
	return false
}

// getOperation retrieves an operation from a path.
func getOperation(spec *openapi3.T, path, method string) *openapi3.Operation {
	pathItem := spec.Paths.Find(path)
	if pathItem == nil {
		return nil
	}

	switch method {
	case "GET":
		return pathItem.Get
	case "POST":
		return pathItem.Post
	case "PATCH":
		return pathItem.Patch
	case "DELETE":
		return pathItem.Delete
	case "PUT":
		return pathItem.Put
	}
	return nil
}

// getAllTags extracts all tags used in the spec.
func getAllTags(spec *openapi3.T) map[string]bool {
	tags := make(map[string]bool)
	for _, pathItem := range spec.Paths.Map() {
		for _, op := range []*openapi3.Operation{
			pathItem.Get, pathItem.Post, pathItem.Patch,
			pathItem.Delete, pathItem.Put,
		} {
			if op != nil && len(op.Tags) > 0 {
				for _, tag := range op.Tags {
					tags[tag] = true
				}
			}
		}
	}
	return tags
}
