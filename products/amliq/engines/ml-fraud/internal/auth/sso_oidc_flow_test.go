package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"quantumbeam/internal/models"
)

func TestBuildOIDCRedirectURL(t *testing.T) {
	t.Run("trims trailing slash", func(t *testing.T) {
		redirect := buildOIDCRedirectURL("https://app.example.com/", "okta")
		assert.Equal(t, "https://app.example.com/auth/sso/okta/callback", redirect)
	})

	t.Run("keeps clean base url", func(t *testing.T) {
		redirect := buildOIDCRedirectURL("https://app.example.com", "azure")
		assert.Equal(t, "https://app.example.com/auth/sso/azure/callback", redirect)
	})
}

func TestMapOIDCGroupsToRole(t *testing.T) {
	attributeMap := map[string]string{
		"role_group_admin":     "grp-admin",
		"role_group_enterprise": "grp-ent",
		"role_group_developer": "grp-dev",
		"role_group_viewer":    "grp-view",
	}

	role, ok := mapOIDCGroupsToRole([]string{"foo", "grp-dev"}, attributeMap)
	assert.True(t, ok)
	assert.Equal(t, models.UserRoleDeveloper, role)

	role, ok = mapOIDCGroupsToRole([]string{"grp-admin"}, attributeMap)
	assert.True(t, ok)
	assert.Equal(t, models.UserRoleAdmin, role)

	_, ok = mapOIDCGroupsToRole([]string{"unknown"}, attributeMap)
	assert.False(t, ok)
}

func TestOIDCStateValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := &SSOHandlers{}

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/auth/sso/oidc/callback?code=abc&state=state-1", nil)
	req.AddCookie(&http.Cookie{Name: "sso_state", Value: "state-1"})
	ctx.Request = req
	assert.True(t, handler.handleOIDCState(ctx))

	ctx2, _ := gin.CreateTestContext(httptest.NewRecorder())
	req2 := httptest.NewRequest("GET", "/auth/sso/oidc/callback?code=abc&state=bad", nil)
	req2.AddCookie(&http.Cookie{Name: "sso_state", Value: "state-1"})
	ctx2.Request = req2
	assert.False(t, handler.handleOIDCState(ctx2))
}

