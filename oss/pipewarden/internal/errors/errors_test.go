package errors

import (
	stderrors "errors"
	"testing"
)

func TestAppErrorMessageOverridesUnderlying(t *testing.T) {
	base := stderrors.New("base failure")
	app := New(base, "Op", "CODE", "user-facing message")

	if got := app.Error(); got != "user-facing message" {
		t.Fatalf("Error() = %q, want user-facing message", got)
	}
	if app.Unwrap() != base {
		t.Fatalf("Unwrap() should return base error")
	}
}

func TestAppErrorFallsBackToWrappedMessage(t *testing.T) {
	base := stderrors.New("inner")
	app := New(base, "Op", "CODE", "")
	if got := app.Error(); got != "inner" {
		t.Fatalf("Error() = %q, want inner", got)
	}
}

func TestErrorf(t *testing.T) {
	app := Errorf("bad thing: %d", 42)
	if app.Error() != "bad thing: 42" {
		t.Fatalf("Errorf message wrong: %q", app.Error())
	}
	if app.Unwrap() == nil {
		t.Fatalf("Errorf must wrap an inner error")
	}
}

func TestIsMatchesSentinels(t *testing.T) {
	app := New(ErrNotFound, "Op", "404", "missing")
	if !Is(app, ErrNotFound) {
		t.Fatalf("Is must walk the chain to find ErrNotFound")
	}
	if Is(app, ErrUnauthorized) {
		t.Fatalf("Is must return false for unrelated sentinel")
	}
}

func TestAsExtractsAppError(t *testing.T) {
	app := New(ErrInternal, "Op", "500", "boom")
	var target *AppError
	if !As(app, &target) {
		t.Fatalf("As must extract *AppError")
	}
	if target.Code != "500" || target.Op != "Op" {
		t.Fatalf("extracted AppError has wrong fields: %+v", target)
	}
}

func TestSentinelsAreDistinct(t *testing.T) {
	all := []error{ErrNotFound, ErrInvalidInput, ErrUnauthorized, ErrForbidden, ErrInternal, ErrNotImplemented, ErrAlreadyExists, ErrTimeout, ErrTemporaryFailure}
	seen := map[string]bool{}
	for _, e := range all {
		if seen[e.Error()] {
			t.Fatalf("duplicate sentinel message: %q", e.Error())
		}
		seen[e.Error()] = true
	}
}
