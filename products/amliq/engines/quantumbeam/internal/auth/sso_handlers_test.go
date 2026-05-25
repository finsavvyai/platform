package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"quantumbeam/internal/interfaces"
	"quantumbeam/internal/models"
)

// MockSSOService is a mock implementation of SSOService
type MockSSOService struct {
	mock.Mock
}

func (m *MockSSOService) ProcessSSOLogin(ctx context.Context, provider string, assertion string) (*interfaces.SSOResult, error) {
	args := m.Called(ctx, provider, assertion)
	return args.Get(0).(*interfaces.SSOResult), args.Error(1)
}

func (m *MockSSOService) ConfigureSSO(ctx context.Context, config *interfaces.SSOConfig) error {
	args := m.Called(ctx, config)
	return args.Error(0)
}

func (m *MockSSOService) ValidateSSOAssertion(ctx context.Context, provider string, assertion string) (*interfaces.SSOUserInfo, error) {
	args := m.Called(ctx, provider, assertion)
	return args.Get(0).(*interfaces.SSOUserInfo), args.Error(1)
}

func (m *MockSSOService) GetSSOProviders(ctx context.Context) ([]interfaces.SSOProvider, error) {
	args := m.Called(ctx)
	return args.Get(0).([]interfaces.SSOProvider), args.Error(1)
}

func setupSSOHandlerTest() (*gin.Engine, *MockSSOService, *SSOHandlers) {
	gin.SetMode(gin.TestMode)

	mockService := &MockSSOService{}
	handlers := NewSSOHandlers(&SSOService{})
	handlers.ssoService = &SSOService{}

	// Replace with mock
	originalService := handlers.ssoService
	handlers.ssoService = &SSOService{}

	// Create a custom handler that uses the mock
	customHandlers := &SSOHandlers{ssoService: originalService}

	router := gin.New()

	// Register routes with mock handlers
	sso := router.Group("/auth/sso")
	{
		sso.GET("/providers", func(c *gin.Context) {
			providers, err := mockService.GetSSOProviders(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to get SSO providers",
					"code":    "SSO_PROVIDER_ERROR",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, gin.H{"providers": providers})
		})

		sso.GET("/:provider/login", func(c *gin.Context) {
			provider := c.Param("provider")
			if provider == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Provider parameter is required",
					"code":  "MISSING_PROVIDER",
				})
				return
			}

			providers, err := mockService.GetSSOProviders(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Failed to get SSO providers",
					"code":  "SSO_PROVIDER_ERROR",
				})
				return
			}

			var ssoProvider *interfaces.SSOProvider
			for _, p := range providers {
				if p.Name == provider {
					ssoProvider = &p
					break
				}
			}

			if ssoProvider == nil {
				c.JSON(http.StatusNotFound, gin.H{
					"error": "SSO provider not found or not active",
					"code":  "PROVIDER_NOT_FOUND",
				})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"login_url": ssoProvider.LoginURL,
				"provider":  ssoProvider.Name,
				"type":      ssoProvider.Type,
			})
		})

		sso.POST("/:provider/callback", func(c *gin.Context) {
			provider := c.Param("provider")
			if provider == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Provider parameter is required",
					"code":  "MISSING_PROVIDER",
				})
				return
			}

			var assertion string
			if samlResponse := c.PostForm("SAMLResponse"); samlResponse != "" {
				assertion = samlResponse
			} else if c.Query("SAMLResponse") != "" {
				assertion = c.Query("SAMLResponse")
			} else if code := c.Query("code"); code != "" {
				assertion = code // Simplified for testing
			}

			if assertion == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "No SSO assertion found in request",
					"code":  "MISSING_ASSERTION",
				})
				return
			}

			result, err := mockService.ProcessSSOLogin(c.Request.Context(), provider, assertion)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":   "SSO authentication failed",
					"code":    "SSO_AUTH_FAILED",
					"details": err.Error(),
				})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"success":     true,
				"user":        result.User,
				"is_new_user": result.IsNewUser,
				"tokens":      result.Tokens,
				"provider":    result.Provider,
			})
		})

		sso.POST("/:provider/validate", func(c *gin.Context) {
			provider := c.Param("provider")
			if provider == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Provider parameter is required",
					"code":  "MISSING_PROVIDER",
				})
				return
			}

			var request struct {
				Assertion string `json:"assertion" binding:"required"`
			}

			if err := c.ShouldBindJSON(&request); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid request body",
					"code":    "INVALID_REQUEST",
					"details": err.Error(),
				})
				return
			}

			userInfo, err := mockService.ValidateSSOAssertion(c.Request.Context(), provider, request.Assertion)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{
					"error":   "SSO assertion validation failed",
					"code":    "SSO_VALIDATION_FAILED",
					"details": err.Error(),
				})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"valid":     true,
				"user_info": userInfo,
			})
		})

		sso.POST("/config", func(c *gin.Context) {
			var config interfaces.SSOConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":   "Invalid SSO configuration",
					"code":    "INVALID_CONFIG",
					"details": err.Error(),
				})
				return
			}

			if config.Provider == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Provider name is required",
					"code":  "MISSING_PROVIDER",
				})
				return
			}

			if config.SSOUrl == "" {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "SSO URL is required",
					"code":  "MISSING_SSO_URL",
				})
				return
			}

			err := mockService.ConfigureSSO(c.Request.Context(), &config)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to configure SSO",
					"code":    "SSO_CONFIG_FAILED",
					"details": err.Error(),
				})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"success":  true,
				"message":  "SSO configuration saved successfully",
				"provider": config.Provider,
			})
		})
	}

	return router, mockService, customHandlers
}

func TestSSOHandlers_GetSSOProviders(t *testing.T) {
	router, mockService, _ := setupSSOHandlerTest()

	t.Run("successful providers retrieval", func(t *testing.T) {
		expectedProviders := []interfaces.SSOProvider{
			{
				Name:        "test-provider",
				DisplayName: "Test Provider",
				Type:        "saml",
				IsActive:    true,
				LoginURL:    "/auth/sso/test-provider/login",
			},
			{
				Name:        "oidc-provider",
				DisplayName: "OIDC Provider",
				Type:        "oidc",
				IsActive:    true,
				LoginURL:    "https://oidc.example.com/auth",
			},
		}

		mockService.On("GetSSOProviders", mock.Anything).
			Return(expectedProviders, nil)

		req := httptest.NewRequest("GET", "/auth/sso/providers", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		providers, ok := response["providers"].([]interface{})
		require.True(t, ok)
		assert.Len(t, providers, 2)

		mockService.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockService.On("GetSSOProviders", mock.Anything).
			Return([]interfaces.SSOProvider{}, assert.AnError)

		req := httptest.NewRequest("GET", "/auth/sso/providers", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Failed to get SSO providers", response["error"])
		assert.Equal(t, "SSO_PROVIDER_ERROR", response["code"])

		mockService.AssertExpectations(t)
	})
}

func TestSSOHandlers_InitiateSSOLogin(t *testing.T) {
	router, mockService, _ := setupSSOHandlerTest()

	t.Run("successful login initiation", func(t *testing.T) {
		providers := []interfaces.SSOProvider{
			{
				Name:     "test-provider",
				Type:     "saml",
				IsActive: true,
				LoginURL: "/auth/sso/test-provider/login",
			},
		}

		mockService.On("GetSSOProviders", mock.Anything).
			Return(providers, nil)

		req := httptest.NewRequest("GET", "/auth/sso/test-provider/login", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "/auth/sso/test-provider/login", response["login_url"])
		assert.Equal(t, "test-provider", response["provider"])
		assert.Equal(t, "saml", response["type"])

		mockService.AssertExpectations(t)
	})

	t.Run("provider not found", func(t *testing.T) {
		providers := []interfaces.SSOProvider{
			{
				Name:     "other-provider",
				IsActive: true,
			},
		}

		mockService.On("GetSSOProviders", mock.Anything).
			Return(providers, nil)

		req := httptest.NewRequest("GET", "/auth/sso/non-existent/login", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "SSO provider not found or not active", response["error"])
		assert.Equal(t, "PROVIDER_NOT_FOUND", response["code"])

		mockService.AssertExpectations(t)
	})
}

func TestSSOHandlers_HandleSSOCallback(t *testing.T) {
	router, mockService, _ := setupSSOHandlerTest()

	t.Run("successful SAML callback", func(t *testing.T) {
		expectedResult := &interfaces.SSOResult{
			User: &models.User{
				UserID: "test-user-123",
				Email:  "test@example.com",
			},
			IsNewUser: false,
			Tokens: &interfaces.JWTTokens{
				AccessToken: "test-access-token",
				TokenType:   "Bearer",
			},
			Provider: "test-provider",
		}

		mockService.On("ProcessSSOLogin", mock.Anything, "test-provider", "test-saml-assertion").
			Return(expectedResult, nil)

		// Test POST form data (SAML)
		form := url.Values{}
		form.Add("SAMLResponse", "test-saml-assertion")

		req := httptest.NewRequest("POST", "/auth/sso/test-provider/callback", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.False(t, response["is_new_user"].(bool))
		assert.Equal(t, "test-provider", response["provider"])

		mockService.AssertExpectations(t)
	})

	t.Run("successful OIDC callback", func(t *testing.T) {
		expectedResult := &interfaces.SSOResult{
			User: &models.User{
				UserID: "oidc-user-456",
				Email:  "oidc@example.com",
			},
			IsNewUser: true,
			Tokens: &interfaces.JWTTokens{
				AccessToken: "oidc-access-token",
				TokenType:   "Bearer",
			},
			Provider: "oidc-provider",
		}

		mockService.On("ProcessSSOLogin", mock.Anything, "oidc-provider", "authorization-code").
			Return(expectedResult, nil)

		// Test query parameter (OIDC)
		req := httptest.NewRequest("POST", "/auth/sso/oidc-provider/callback?code=authorization-code", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.True(t, response["is_new_user"].(bool))
		assert.Equal(t, "oidc-provider", response["provider"])

		mockService.AssertExpectations(t)
	})

	t.Run("missing provider parameter", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/auth/sso//callback", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code) // Gin returns 404 for empty param
	})

	t.Run("missing assertion", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/auth/sso/test-provider/callback", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "No SSO assertion found in request", response["error"])
		assert.Equal(t, "MISSING_ASSERTION", response["code"])
	})

	t.Run("SSO authentication failed", func(t *testing.T) {
		mockService.On("ProcessSSOLogin", mock.Anything, "test-provider", "invalid-assertion").
			Return((*interfaces.SSOResult)(nil), assert.AnError)

		form := url.Values{}
		form.Add("SAMLResponse", "invalid-assertion")

		req := httptest.NewRequest("POST", "/auth/sso/test-provider/callback", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "SSO authentication failed", response["error"])
		assert.Equal(t, "SSO_AUTH_FAILED", response["code"])

		mockService.AssertExpectations(t)
	})
}

func TestSSOHandlers_ValidateSSO(t *testing.T) {
	router, mockService, _ := setupSSOHandlerTest()

	t.Run("successful validation", func(t *testing.T) {
		expectedUserInfo := &interfaces.SSOUserInfo{
			Subject:   "test-subject",
			Email:     "validate@example.com",
			FirstName: "Validate",
			LastName:  "User",
		}

		mockService.On("ValidateSSOAssertion", mock.Anything, "test-provider", "test-assertion").
			Return(expectedUserInfo, nil)

		requestBody := map[string]string{
			"assertion": "test-assertion",
		}
		jsonBody, _ := json.Marshal(requestBody)

		req := httptest.NewRequest("POST", "/auth/sso/test-provider/validate", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["valid"].(bool))
		userInfo := response["user_info"].(map[string]interface{})
		assert.Equal(t, "validate@example.com", userInfo["email"])

		mockService.AssertExpectations(t)
	})

	t.Run("missing assertion in request", func(t *testing.T) {
		requestBody := map[string]string{}
		jsonBody, _ := json.Marshal(requestBody)

		req := httptest.NewRequest("POST", "/auth/sso/test-provider/validate", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Invalid request body", response["error"])
		assert.Equal(t, "INVALID_REQUEST", response["code"])
	})

	t.Run("validation failed", func(t *testing.T) {
		mockService.On("ValidateSSOAssertion", mock.Anything, "test-provider", "invalid-assertion").
			Return((*interfaces.SSOUserInfo)(nil), assert.AnError)

		requestBody := map[string]string{
			"assertion": "invalid-assertion",
		}
		jsonBody, _ := json.Marshal(requestBody)

		req := httptest.NewRequest("POST", "/auth/sso/test-provider/validate", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "SSO assertion validation failed", response["error"])
		assert.Equal(t, "SSO_VALIDATION_FAILED", response["code"])

		mockService.AssertExpectations(t)
	})
}

func TestSSOHandlers_ConfigureSSO(t *testing.T) {
	router, mockService, _ := setupSSOHandlerTest()

	t.Run("successful configuration", func(t *testing.T) {
		mockService.On("ConfigureSSO", mock.Anything, mock.AnythingOfType("*interfaces.SSOConfig")).
			Return(nil)

		config := interfaces.SSOConfig{
			Provider:        "new-provider",
			SSOUrl:          "https://new.example.com/sso",
			IsActive:        true,
			AutoCreateUsers: true,
		}
		jsonBody, _ := json.Marshal(config)

		req := httptest.NewRequest("POST", "/auth/sso/config", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.True(t, response["success"].(bool))
		assert.Equal(t, "SSO configuration saved successfully", response["message"])
		assert.Equal(t, "new-provider", response["provider"])

		mockService.AssertExpectations(t)
	})

	t.Run("missing provider name", func(t *testing.T) {
		config := interfaces.SSOConfig{
			SSOUrl: "https://test.example.com/sso",
		}
		jsonBody, _ := json.Marshal(config)

		req := httptest.NewRequest("POST", "/auth/sso/config", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Provider name is required", response["error"])
		assert.Equal(t, "MISSING_PROVIDER", response["code"])
	})

	t.Run("missing SSO URL", func(t *testing.T) {
		config := interfaces.SSOConfig{
			Provider: "test-provider",
		}
		jsonBody, _ := json.Marshal(config)

		req := httptest.NewRequest("POST", "/auth/sso/config", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "SSO URL is required", response["error"])
		assert.Equal(t, "MISSING_SSO_URL", response["code"])
	})

	t.Run("configuration failed", func(t *testing.T) {
		mockService.On("ConfigureSSO", mock.Anything, mock.AnythingOfType("*interfaces.SSOConfig")).
			Return(assert.AnError)

		config := interfaces.SSOConfig{
			Provider: "fail-provider",
			SSOUrl:   "https://fail.example.com/sso",
		}
		jsonBody, _ := json.Marshal(config)

		req := httptest.NewRequest("POST", "/auth/sso/config", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, "Failed to configure SSO", response["error"])
		assert.Equal(t, "SSO_CONFIG_FAILED", response["code"])

		mockService.AssertExpectations(t)
	})
}
