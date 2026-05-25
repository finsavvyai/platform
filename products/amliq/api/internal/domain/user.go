package domain

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

type User struct {
	ID         string
	TenantID   string
	Email      string
	Password   string
	Role       string
	Provider   string
	ProviderID string
	Name       string
	AvatarURL  string
	CreatedAt  time.Time
}

func NewUser(tenantID, email, password, role string) (User, error) {
	if tenantID == "" || email == "" {
		return User{}, fmt.Errorf("tenant_id and email required")
	}
	if role == "" {
		role = "admin"
	}
	return User{
		ID:        generateUserID(),
		TenantID:  tenantID,
		Email:     email,
		Password:  password,
		Role:      role,
		Provider:  "email",
		CreatedAt: time.Now().UTC(),
	}, nil
}

func NewOAuthUser(tenantID, email, provider, providerID, name string) (User, error) {
	if email == "" || provider == "" {
		return User{}, fmt.Errorf("email and provider required")
	}
	return User{
		ID:         generateUserID(),
		TenantID:   tenantID,
		Email:      email,
		Role:       "admin",
		Provider:   provider,
		ProviderID: providerID,
		Name:       name,
		CreatedAt:  time.Now().UTC(),
	}, nil
}

func generateUserID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return "usr_" + hex.EncodeToString(b)
}
