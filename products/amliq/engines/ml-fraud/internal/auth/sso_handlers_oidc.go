package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func (h *SSOHandlers) buildOIDCLoginURL(c *gin.Context, provider string) (string, string, error) {
	state, err := randomState()
	if err != nil {
		return "", "", err
	}
	baseURL := requestBaseURL(c)
	loginURL, err := h.ssoService.BuildOIDCLoginURL(c.Request.Context(), provider, baseURL, state)
	if err != nil {
		return "", "", err
	}
	return loginURL, state, nil
}

func (h *SSOHandlers) exchangeOIDCCodeForIDToken(c *gin.Context, provider, code string) (string, error) {
	if !oidcEnabled() {
		return "", fmt.Errorf("OIDC SSO disabled by configuration")
	}
	return h.ssoService.ExchangeOIDCCode(c.Request.Context(), provider, code, requestBaseURL(c))
}

func requestBaseURL(c *gin.Context) string {
	if base := strings.TrimSpace(os.Getenv("SSO_BASE_URL")); base != "" {
		return strings.TrimSuffix(base, "/")
	}
	scheme := "https"
	if c.Request.TLS == nil && c.GetHeader("X-Forwarded-Proto") == "" {
		scheme = "http"
	}
	if forwarded := c.GetHeader("X-Forwarded-Proto"); forwarded != "" {
		scheme = forwarded
	}
	return fmt.Sprintf("%s://%s", scheme, c.Request.Host)
}

func oidcEnabled() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("ENABLE_OIDC_SSO")))
	return value == "" || value == "1" || value == "true" || value == "yes"
}

func randomState() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func (h *SSOHandlers) setStateCookie(c *gin.Context, state string) {
	c.SetCookie("sso_state", state, 300, "/", "", !isLocalRequest(c.Request.Host), true)
}

func isLocalRequest(host string) bool {
	return strings.Contains(host, "localhost") || strings.Contains(host, "127.0.0.1")
}

func (h *SSOHandlers) stateFromCookie(c *gin.Context) string {
	state, _ := c.Cookie("sso_state")
	return state
}

func (h *SSOHandlers) clearStateCookie(c *gin.Context) {
	c.SetCookie("sso_state", "", -1, "/", "", !isLocalRequest(c.Request.Host), true)
}

func (h *SSOHandlers) verifyOIDCState(c *gin.Context) error {
	expected := h.stateFromCookie(c)
	actual := c.Query("state")
	if expected == "" || actual == "" || expected != actual {
		return fmt.Errorf("OIDC state mismatch")
	}
	h.clearStateCookie(c)
	return nil
}

func (h *SSOHandlers) rejectWithStatus(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{
		"error": message,
		"code":  code,
	})
}

func (h *SSOHandlers) handleOIDCState(c *gin.Context) bool {
	if c.Query("code") == "" {
		return true
	}
	if err := h.verifyOIDCState(c); err != nil {
		h.rejectWithStatus(c, http.StatusBadRequest, "OIDC_STATE_INVALID", err.Error())
		return false
	}
	return true
}

