package domain

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
)

type TenantID struct {
	value string
}

var tenantIDRegex = regexp.MustCompile(`^tnt_[a-z0-9]{12}$`)

func NewTenantID(id string) (TenantID, error) {
	if !tenantIDRegex.MatchString(id) {
		return TenantID{}, fmt.Errorf("invalid tenant id format: %s", id)
	}
	return TenantID{value: id}, nil
}

func (t TenantID) String() string {
	return t.value
}

func (t TenantID) Value() string {
	return t.value
}

func (t TenantID) IsZero() bool {
	return t.value == ""
}

func (t TenantID) MarshalJSON() ([]byte, error) {
	return json.Marshal(t.value)
}

func (t *TenantID) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	parsed, err := NewTenantID(s)
	if err != nil {
		return err
	}
	*t = parsed
	return nil
}

func GenerateTenantID() (TenantID, error) {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		return TenantID{}, fmt.Errorf("generate tenant id: %w", err)
	}
	return NewTenantID("tnt_" + hex.EncodeToString(b))
}
