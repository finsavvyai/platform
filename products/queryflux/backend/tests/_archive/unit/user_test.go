package entities

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewUser(t *testing.T) {
	tests := []struct {
		name      string
		email     string
		name      string
		password  string
		expectErr bool
	}{
		{
			name:      "valid user",
			email:     "test@example.com",
			name:      "Test User",
			password:  "hashedpassword123",
			expectErr: false,
		},
		{
			name:      "invalid email",
			email:     "invalid-email",
			name:      "Test User",
			password:  "hashedpassword123",
			expectErr: true,
		},
		{
			name:      "empty password",
			email:     "test@example.com",
			name:      "Test User",
			password:  "",
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user, err := NewUser(tt.email, tt.name, tt.password)

			if tt.expectErr {
				assert.Error(t, err)
				assert.Nil(t, user)
			} else {
				require.NoError(t, err)
				assert.NotNil(t, user)
				assert.Equal(t, tt.email, user.Email)
				assert.Equal(t, tt.name, user.Name)
			}
		})
	}
}
