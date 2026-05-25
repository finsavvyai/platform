package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

var validSeverities = map[string]bool{
	"critical": true, "high": true, "medium": true, "low": true,
}

var slugRe = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

func validatePolicy(p storage.PolicyRow) error {
	if p.ID == "" {
		return errorf("id is required")
	}
	if !slugRe.MatchString(p.ID) {
		return errorf("id must be lowercase letters, digits, and hyphens (e.g. require-pinned-actions)")
	}
	if p.Name == "" {
		return errorf("name is required")
	}
	if p.Pattern == "" {
		return errorf("pattern is required")
	}
	if _, err := regexp.Compile(p.Pattern); err != nil {
		return errorf("pattern is not valid regex: " + err.Error())
	}
	if p.Message == "" {
		return errorf("message is required")
	}
	if p.Severity != "" && !validSeverities[p.Severity] {
		return errorf("severity must be one of critical, high, medium, low")
	}
	return nil
}

func errorf(msg string) error {
	return &policyValidationError{msg}
}

type policyValidationError struct{ msg string }

func (e *policyValidationError) Error() string { return e.msg }

func policyIDFromPath(path string) string {
	const customPrefix = "/api/v1/policies/custom/"
	const prefix = "/api/v1/policies/"
	switch {
	case strings.HasPrefix(path, customPrefix):
		path = strings.TrimPrefix(path, customPrefix)
	default:
		path = strings.TrimPrefix(path, prefix)
	}
	parts := strings.SplitN(path, "/", 2)
	return parts[0]
}

// ListCustomPolicies returns only user-created (non-built-in) policies.
func (h *Handlers) ListCustomPolicies(w http.ResponseWriter, r *http.Request) {
	all, err := h.db.ListPolicies()
	if err != nil {
		jsonError(w, "failed to list policies", http.StatusInternalServerError)
		return
	}
	custom := make([]storage.PolicyRow, 0, len(all))
	for _, p := range all {
		if !p.IsBuiltin {
			custom = append(custom, p)
		}
	}
	jsonOK(w, map[string]interface{}{"policies": custom, "count": len(custom)})
}
