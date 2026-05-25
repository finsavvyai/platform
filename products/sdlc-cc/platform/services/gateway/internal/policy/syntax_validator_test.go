package policy

import (
	"errors"
	"strings"
	"testing"
)

func TestValidate_AcceptsValidRego(t *testing.T) {
	v := NewSyntaxValidator()
	src := `package authz

	default allow := false

	allow if {
		input.user.role == "admin"
	}`
	if err := v.Validate("authz.rego", src); err != nil {
		t.Fatalf("valid Rego must pass, got: %v", err)
	}
}

func TestValidate_RejectsEmpty(t *testing.T) {
	v := NewSyntaxValidator()
	for _, in := range []string{"", "   ", "\n\t\n"} {
		if err := v.Validate("x.rego", in); !errors.Is(err, ErrEmptyPolicy) {
			t.Fatalf("expected ErrEmptyPolicy for %q, got %v", in, err)
		}
	}
}

func TestValidate_RejectsParseError(t *testing.T) {
	v := NewSyntaxValidator()
	src := `package authz

	allow ::= unparseable !!! syntax`
	err := v.Validate("authz.rego", src)
	if err == nil {
		t.Fatal("malformed Rego must fail")
	}
	var se *SyntaxError
	if !errors.As(err, &se) {
		t.Fatalf("error must wrap *SyntaxError, got %T: %v", err, err)
	}
	if se.Module != "authz.rego" {
		t.Errorf("module: want authz.rego got %q", se.Module)
	}
	if se.Line < 1 {
		t.Errorf("line should be >0, got %d", se.Line)
	}
}

func TestValidate_ErrorIncludesFileLocation(t *testing.T) {
	v := NewSyntaxValidator()
	src := `package authz
	allow if { 123 + }`
	err := v.Validate("policy.rego", src)
	if err == nil {
		t.Fatal("malformed Rego must fail")
	}
	if !strings.Contains(err.Error(), "policy.rego:") {
		t.Fatalf("error must include file:line, got: %s", err.Error())
	}
}

func TestValidate_RejectsUnboundVariable(t *testing.T) {
	v := NewSyntaxValidator()
	// `x` is not defined anywhere — semantic compile error.
	src := `package authz
	allow if { x == 1 }`
	if err := v.Validate("policy.rego", src); err == nil {
		t.Fatal("unbound var must fail compile")
	}
}

func TestValidate_AcceptsMultiRulePolicy(t *testing.T) {
	v := NewSyntaxValidator()
	src := `package authz

	default allow := false

	allow if {
		input.user.role == "admin"
	}

	allow if {
		input.user.id == input.resource.owner
	}`
	if err := v.Validate("authz.rego", src); err != nil {
		t.Fatalf("multi-rule policy must pass, got: %v", err)
	}
}
