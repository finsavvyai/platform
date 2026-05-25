package api

import (
	"context"
	"errors"
)

type mockAPIKeyValidator struct {
	keyInfoMap map[string]*APIKeyInfo
}

func (m *mockAPIKeyValidator) ValidateKey(_ context.Context,
	keyHash string) (*APIKeyInfo, error) {
	info, ok := m.keyInfoMap[keyHash]
	if !ok {
		return nil, errors.New("not found")
	}
	return info, nil
}
