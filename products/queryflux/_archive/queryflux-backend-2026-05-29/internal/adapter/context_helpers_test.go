package adapter

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetUserID_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	expectedUserID := "user-456"
	c.Set(UserIDKey, expectedUserID)

	userID, exists := GetUserID(c)

	assert.True(t, exists)
	assert.Equal(t, expectedUserID, userID)
}

func TestGetUserID_NotExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	userID, exists := GetUserID(c)

	assert.False(t, exists)
	assert.Empty(t, userID)
}

func TestGetUserID_InvalidType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	c.Set(UserIDKey, 12345)

	userID, exists := GetUserID(c)

	assert.False(t, exists)
	assert.Empty(t, userID)
}

func TestGetUserEmail_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	expectedEmail := "test@example.com"
	c.Set(UserEmailKey, expectedEmail)

	email, exists := GetUserEmail(c)

	assert.True(t, exists)
	assert.Equal(t, expectedEmail, email)
}

func TestGetUserEmail_NotExists(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	email, exists := GetUserEmail(c)

	assert.False(t, exists)
	assert.Empty(t, email)
}

func TestGetUserEmail_InvalidType(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	c.Set(UserEmailKey, 12345)

	email, exists := GetUserEmail(c)

	assert.False(t, exists)
	assert.Empty(t, email)
}
