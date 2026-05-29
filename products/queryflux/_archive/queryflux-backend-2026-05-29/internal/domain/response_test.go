package domain

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSuccessResponse(t *testing.T) {
	resp := SuccessResponse("hello")
	assert.True(t, resp.Success)
	assert.Equal(t, "hello", resp.Data)
	assert.Empty(t, resp.Message)
}

func TestSuccessMessageResponse(t *testing.T) {
	resp := SuccessMessageResponse(42, "created")
	assert.True(t, resp.Success)
	assert.Equal(t, 42, resp.Data)
	assert.Equal(t, "created", resp.Message)
}

func TestErrorResponse(t *testing.T) {
	resp := ErrorResponse("bad request")
	assert.False(t, resp.Success)
	assert.Nil(t, resp.Data)
	assert.Equal(t, "bad request", resp.Message)
}
