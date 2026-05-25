package validation

import (
	"testing"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultResponseSanitizer_SanitizeResponse(t *testing.T) {
	s := NewDefaultResponseSanitizer(5000)
	resp := &models.CompletionResponse{
		Choices: []models.Choice{
			{Message: models.Message{Role: "assistant", Content: "Hello"}},
		},
	}
	out := s.SanitizeResponse(resp)
	require.NotNil(t, out)
	require.Len(t, out.Choices, 1)
	assert.Equal(t, "Hello", out.Choices[0].Message.Content)
	assert.Equal(t, "standard", out.Metadata["sanitization_level"])
}

func TestDefaultResponseSanitizer_ValidateResponse(t *testing.T) {
	s := NewDefaultResponseSanitizer(100)
	require.NoError(t, s.ValidateResponse(&models.CompletionResponse{
		Choices: []models.Choice{{Message: models.Message{Content: "Safe content"}}},
	}))
	err := s.ValidateResponse(&models.CompletionResponse{
		Choices: []models.Choice{{Message: models.Message{Content: "I want to kill"}}},
	})
	require.Error(t, err)
	assert.Equal(t, ErrHarmfulContent, err)
	long := string(make([]byte, 101))
	err = s.ValidateResponse(&models.CompletionResponse{
		Choices: []models.Choice{{Message: models.Message{Content: long}}},
	})
	require.Error(t, err)
	assert.Equal(t, ErrResponseTooLong, err)
}

func TestDefaultResponseSanitizer_ContainsPii(t *testing.T) {
	s := NewDefaultResponseSanitizer(1000)
	assert.True(t, s.ContainsPii("Contact me at test@example.com"))
	assert.True(t, s.ContainsPii("SSN: 123-45-6789"))
	assert.False(t, s.ContainsPii("No PII here"))
}

func TestDefaultResponseSanitizer_RedactPii(t *testing.T) {
	s := NewDefaultResponseSanitizer(1000)
	out := s.RedactPii("Email test@example.com and more")
	assert.Contains(t, out, "[REDACTED]")
	assert.NotContains(t, out, "test@example.com")
}
