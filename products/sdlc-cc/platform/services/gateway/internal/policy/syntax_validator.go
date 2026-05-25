// Rego syntax validation for tenant policies.
//
// Day 18 of the production-ready roadmap.
//
// SyntaxValidator wraps the OPA Rego compiler so admin endpoints can
// reject invalid policies at write time with a precise file:line
// pointer. The validator is intentionally lighter than the full
// policy_engine — we don't load data, we just compile.
package policy

import (
	"errors"
	"fmt"
	"strings"

	"github.com/open-policy-agent/opa/v1/ast"
)

// SyntaxValidator validates a Rego policy without evaluating it.
type SyntaxValidator struct{}

// NewSyntaxValidator constructs the zero-value validator. Reserved as
// a function so future config (capabilities file, OPA version pin)
// can plug in without API churn.
func NewSyntaxValidator() *SyntaxValidator { return &SyntaxValidator{} }

// SyntaxError carries the parse / compile failure with a usable
// pointer back to the source row + column.
type SyntaxError struct {
	Module  string // logical filename of the offending policy
	Line    int
	Column  int
	Message string
}

func (e *SyntaxError) Error() string {
	if e.Module != "" {
		return fmt.Sprintf("%s:%d:%d: %s", e.Module, e.Line, e.Column, e.Message)
	}
	return fmt.Sprintf("rego:%d:%d: %s", e.Line, e.Column, e.Message)
}

// Validate parses + compiles the policy. Returns nil on success;
// returns ErrEmptyPolicy when the input is empty/whitespace and one or
// more *SyntaxError values joined via errors.Join when compilation
// fails. Multi-error joining preserves every diagnostic so the admin
// UI can surface them all at once.
func (v *SyntaxValidator) Validate(module, src string) error {
	if strings.TrimSpace(src) == "" {
		return ErrEmptyPolicy
	}
	if module == "" {
		module = "policy.rego"
	}

	parsed, err := ast.ParseModule(module, src)
	if err != nil {
		return joinAstErrors(module, err)
	}
	compiler := ast.NewCompiler()
	compiler.Compile(map[string]*ast.Module{module: parsed})
	if compiler.Failed() {
		return joinAstErrors(module, compiler.Errors)
	}
	return nil
}

// ErrEmptyPolicy is returned when the policy body is empty.
var ErrEmptyPolicy = errors.New("policy: source is empty")

// joinAstErrors flattens OPA's ast.Errors slice (or any error) into
// our own *SyntaxError type and joins them so callers can do
// errors.As across multiple findings.
func joinAstErrors(module string, err error) error {
	var astErrs ast.Errors
	if errors.As(err, &astErrs) {
		out := make([]error, 0, len(astErrs))
		for _, e := range astErrs {
			out = append(out, &SyntaxError{
				Module:  module,
				Line:    e.Location.Row,
				Column:  e.Location.Col,
				Message: e.Message,
			})
		}
		return errors.Join(out...)
	}
	return &SyntaxError{Module: module, Message: err.Error()}
}
