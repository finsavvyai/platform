package auth

import (
	"context"
	"testing"
)

func TestUserIDFromContext_Set(t *testing.T) {
	ctx := context.WithValue(context.Background(), ctxUserID, "user-42")
	if got := UserIDFromContext(ctx); got != "user-42" {
		t.Errorf("got %q, want user-42", got)
	}
}

func TestUserIDFromContext_Unset(t *testing.T) {
	if got := UserIDFromContext(context.Background()); got != "" {
		t.Errorf("got %q, want empty", got)
	}
}

func TestUserIDFromContext_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), ctxUserID, 123) // not a string
	if got := UserIDFromContext(ctx); got != "" {
		t.Errorf("got %q, want empty when type assertion fails", got)
	}
}

func TestTenantIDFromContext_Set(t *testing.T) {
	ctx := context.WithValue(context.Background(), ctxTenantID, "tenant-1")
	if got := TenantIDFromContext(ctx); got != "tenant-1" {
		t.Errorf("got %q, want tenant-1", got)
	}
}

func TestTenantIDFromContext_Unset(t *testing.T) {
	if got := TenantIDFromContext(context.Background()); got != "" {
		t.Errorf("got %q, want empty", got)
	}
}

func TestUserEmailFromContext_Set(t *testing.T) {
	ctx := context.WithValue(context.Background(), ctxUserEmail, "alice@example.com")
	if got := UserEmailFromContext(ctx); got != "alice@example.com" {
		t.Errorf("got %q, want alice@example.com", got)
	}
}

func TestUserEmailFromContext_Unset(t *testing.T) {
	if got := UserEmailFromContext(context.Background()); got != "" {
		t.Errorf("got %q, want empty", got)
	}
}
