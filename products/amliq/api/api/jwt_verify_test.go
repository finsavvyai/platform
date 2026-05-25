package api

import (
	"testing"
	"time"
)

func TestVerifyJWT(t *testing.T) {
	secret := "test-secret-key"
	tests := []struct {
		name    string
		token   string
		secret  string
		wantErr bool
	}{
		{
			name:    "valid token",
			token:   makeTestToken(secret, "tnt_abc123def456", "usr_1", "admin", time.Now().Add(1*time.Hour).Unix()),
			secret:  secret,
			wantErr: false,
		},
		{
			name:    "wrong secret",
			token:   makeTestToken(secret, "tnt_abc123def456", "usr_1", "admin", time.Now().Add(1*time.Hour).Unix()),
			secret:  "wrong",
			wantErr: true,
		},
		{
			name:    "expired token",
			token:   makeTestToken(secret, "tnt_abc123def456", "usr_1", "admin", time.Now().Add(-1*time.Hour).Unix()),
			secret:  secret,
			wantErr: true,
		},
		{
			name:    "too few parts",
			token:   "header.payload",
			secret:  secret,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := VerifyJWT(tt.token, tt.secret)
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantErr && err == nil {
				t.Fatal("expected error")
			}
		})
	}
}

func TestClaimsValid(t *testing.T) {
	tests := []struct {
		name    string
		claims  *Claims
		wantErr bool
	}{
		{
			name: "valid",
			claims: &Claims{
				TenantID: "tnt_abc123def456",
				UserID:   "usr_1",
				Exp:      time.Now().Add(1 * time.Hour).Unix(),
			},
			wantErr: false,
		},
		{
			name:    "missing tenant_id",
			claims:  &Claims{UserID: "usr_1", Exp: time.Now().Add(1 * time.Hour).Unix()},
			wantErr: true,
		},
		{
			name:    "expired",
			claims:  &Claims{TenantID: "tnt_abc123def456", UserID: "usr_1", Exp: time.Now().Add(-1 * time.Hour).Unix()},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.claims.Valid()
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantErr && err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
