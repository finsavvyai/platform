package main

import (
	"os"
	"testing"
)

func TestConfirmApprovalEnvYes(t *testing.T) {
	t.Setenv("PUSHCI_APPROVE", "1")
	if !confirmApproval("deploy", "prod") {
		t.Fatal("expected auto-approve")
	}
}

func TestConfirmApprovalEnvNo(t *testing.T) {
	t.Setenv("PUSHCI_APPROVE", "0")
	if confirmApproval("stage", "release") {
		t.Fatal("expected auto-deny")
	}
}

func TestConfirmApprovalEnvYesAliases(t *testing.T) {
	for _, v := range []string{"true", "yes", "Y", "YES"} {
		t.Run(v, func(t *testing.T) {
			t.Setenv("PUSHCI_APPROVE", v)
			if !confirmApproval("stage", "x") {
				t.Fatalf("%q should auto-approve", v)
			}
		})
	}
}

func TestConfirmApprovalNoTTYDenies(t *testing.T) {
	os.Unsetenv("PUSHCI_APPROVE")
	// Under `go test` stdin is a pipe, not a TTY, so the non-TTY branch
	// fires. It must always return false rather than hang on ReadString.
	if confirmApproval("deploy", "prod") {
		t.Fatal("expected deny when no TTY and no env override")
	}
}

func TestTitleCase(t *testing.T) {
	cases := map[string]string{"": "", "a": "A", "stage": "Stage", "DEPLOY": "DEPLOY"}
	for in, want := range cases {
		if got := titleCase(in); got != want {
			t.Errorf("titleCase(%q) = %q; want %q", in, got, want)
		}
	}
}
