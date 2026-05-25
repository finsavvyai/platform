package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"
	"github.com/sirupsen/logrus"
)

// OpenAPIValidator validates requests and responses against an OpenAPI specification.
type OpenAPIValidator struct {
	spec   *openapi3.T
	router routers.Router
	dev    bool // Enable response validation in dev mode
}

// ErrorResponse represents a validation error response.
type ErrorResponse struct {
	Success bool `json:"success"`
	Error   struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details string `json:"details,omitempty"`
	} `json:"error"`
	Meta struct {
		RequestID string `json:"request_id"`
		Timestamp string `json:"timestamp"`
	} `json:"meta"`
}

// NewOpenAPIValidator creates a new OpenAPI validator with the spec at the given path.
func NewOpenAPIValidator(specPath string, dev bool) (*OpenAPIValidator, error) {
	// Convert to absolute path for OpenAPI spec loading
	absPath, err := filepath.Abs(specPath)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve spec path: %w", err)
	}

	ctx := context.Background()
	loader := &openapi3.Loader{Context: ctx, IsExternalRefsAllowed: true}

	spec, err := loader.LoadFromFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load OpenAPI spec: %w", err)
	}

	// Validate the spec
	if err := spec.Validate(ctx); err != nil {
		return nil, fmt.Errorf("OpenAPI spec validation failed: %w", err)
	}

	// Create router from spec
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenAPI router: %w", err)
	}

	return &OpenAPIValidator{
		spec:   spec,
		router: router,
		dev:    dev,
	}, nil
}

// ValidateRequest validates an incoming HTTP request against the OpenAPI spec.
func (v *OpenAPIValidator) ValidateRequest(w http.ResponseWriter, r *http.Request) (bool, error) {
	route, pathParams, err := v.router.FindRoute(r)
	if err != nil {
		logrus.WithField("path", r.URL.Path).Debug("Path not in spec")
		return true, nil
	}
	op := route.Operation
	if op == nil {
		return true, nil
	}
	for name, value := range pathParams {
		if param := findParameter(op, name, "path"); param != nil {
			if err := validateParameterValue(param, value); err != nil {
				return false, fmt.Errorf("invalid path param '%s': %w", name, err)
			}
		}
	}
	for key, values := range r.URL.Query() {
		if param := findParameter(op, key, "query"); param != nil {
			if err := validateParameterValue(param, values[0]); err != nil {
				return false, fmt.Errorf("invalid query param '%s': %w", key, err)
			}
		}
	}
	return true, nil
}

// ValidateResponse validates an HTTP response against the OpenAPI spec (dev mode only).
func (v *OpenAPIValidator) ValidateResponse(r *http.Request, status int) bool {
	if !v.dev {
		return true
	}
	route, _, err := v.router.FindRoute(r)
	if err != nil {
		return true
	}
	op := route.Operation
	if op == nil || op.Responses == nil {
		return true
	}
	resp := op.Responses.Status(status)
	if resp == nil {
		logrus.WithFields(logrus.Fields{
			"operation": op.OperationID,
			"status":    status,
		}).Warn("Response status not documented")
		return false
	}
	return true
}

// Middleware returns an HTTP middleware for request validation against the OpenAPI spec.
func (v *OpenAPIValidator) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			valid, err := v.ValidateRequest(w, r)
			if !valid || err != nil {
				logrus.WithError(err).WithFields(logrus.Fields{
					"method": r.Method,
					"path":   r.URL.Path,
				}).Warn("Validation failed")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				errResp := ErrorResponse{Success: false}
				errResp.Error.Code = "VALIDATION_ERROR"
				if err != nil {
					errResp.Error.Message = err.Error()
				} else {
					errResp.Error.Message = "Request validation failed"
				}
				// Encode error after headers/status sent is non-actionable.
				_ = json.NewEncoder(w).Encode(errResp)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Helper functions

// findParameter finds a parameter in the operation by name and location.
func findParameter(op *openapi3.Operation, name, in string) *openapi3.Parameter {
	if op.Parameters == nil {
		return nil
	}

	for _, paramRef := range op.Parameters {
		if paramRef == nil || paramRef.Value == nil {
			continue
		}
		if paramRef.Value.Name == name && paramRef.Value.In == in {
			return paramRef.Value
		}
	}

	return nil
}

// validateParameterValue validates a parameter value against its schema.
func validateParameterValue(param *openapi3.Parameter, value string) error {
	if param == nil || param.Schema == nil {
		return nil
	}

	// Basic validation - more complex validation would require full schema parsing
	if value == "" && param.Required {
		return fmt.Errorf("parameter is required")
	}

	return nil
}
