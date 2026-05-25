package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/port"
	"github.com/queryflux/backend/internal/service"
	"github.com/queryflux/backend/pkg/config"
	"github.com/queryflux/backend/pkg/logger"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
)

func setupAuthServer(repo port.UserRepository) *HTTPServer {
	cfg := &config.Config{
		Port: "8080", Environment: "test",
		JWTSecret: "test-auth-secret", AllowedOrigins: "http://localhost:5173",
	}
	log := logger.New("error")
	jwtSvc := service.NewJWTService(cfg.JWTSecret)
	authSvc := service.NewAuthService(repo, jwtSvc)
	authMW := NewAuthMiddleware(jwtSvc)
	db := &mockDB{}
	return NewHTTPServer(cfg, service.NewQueryService(db, log),
		service.NewSchemaService(db, log), authSvc, authMW, log)
}

func TestLogin_Success(t *testing.T) {
	hash, _ := bcrypt.GenerateFromPassword([]byte("Password123!"), bcrypt.MinCost)
	repo := &mockUserRepo{
		findByEmailFunc: func(_ context.Context, email string) (*domain.User, error) {
			return &domain.User{ID: "u-1", Email: email, PasswordHash: string(hash)}, nil
		},
	}
	server := setupAuthServer(repo)

	body, _ := json.Marshal(domain.LoginRequest{Email: "test@test.com", Password: "Password123!"})
	req, _ := http.NewRequest("POST", "/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp domain.LoginResponse
	unwrapAPIData(t, w.Body.Bytes(), &resp)
	assert.NotEmpty(t, resp.AccessToken)
	assert.Equal(t, "Bearer", resp.TokenType)
}

func TestLogin_InvalidCredentials(t *testing.T) {
	server := setupAuthServer(&mockUserRepo{})

	body, _ := json.Marshal(domain.LoginRequest{Email: "bad@test.com", Password: "wrongpass1"})
	req, _ := http.NewRequest("POST", "/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestLogin_BadJSON(t *testing.T) {
	server := setupAuthServer(&mockUserRepo{})

	req, _ := http.NewRequest("POST", "/auth/login", bytes.NewBufferString("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRefreshToken_HTTPSuccess(t *testing.T) {
	jwtSvc := service.NewJWTService("test-auth-secret")
	refreshToken, _ := jwtSvc.GenerateRefreshToken("u-1", "test@test.com")

	repo := &mockUserRepo{
		findRefreshFunc: func(_ context.Context, token, userID string) (*domain.RefreshToken, error) {
			return &domain.RefreshToken{
				ID: "rt-1", UserID: userID, Token: token,
				ExpiresAt: time.Now().Add(24 * time.Hour),
			}, nil
		},
	}
	server := setupAuthServer(repo)

	body, _ := json.Marshal(domain.RefreshRequest{RefreshToken: refreshToken})
	req, _ := http.NewRequest("POST", "/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRefreshToken_HTTPInvalid(t *testing.T) {
	server := setupAuthServer(&mockUserRepo{})

	body, _ := json.Marshal(domain.RefreshRequest{RefreshToken: "bad-token"})
	req, _ := http.NewRequest("POST", "/auth/refresh", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRefreshToken_HTTPBadJSON(t *testing.T) {
	server := setupAuthServer(&mockUserRepo{})

	req, _ := http.NewRequest("POST", "/auth/refresh", bytes.NewBufferString("bad"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	server.Router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestWithConnectionHandler_Option(t *testing.T) {
	connSvc := service.NewConnectionService(&mockConnRepo{}, "test-encryption-key-32bytes!!")
	handler := NewConnectionHandler(connSvc)

	cfg := &config.Config{
		Port: "8080", Environment: "test",
		JWTSecret: "test-secret", AllowedOrigins: "http://localhost:5173",
	}
	log := logger.New("error")
	jwtSvc := service.NewJWTService(cfg.JWTSecret)
	db := &mockDB{}

	server := NewHTTPServer(cfg,
		service.NewQueryService(db, log), service.NewSchemaService(db, log),
		service.NewAuthService(nil, jwtSvc), NewAuthMiddleware(jwtSvc), log,
		WithConnectionHandler(handler),
	)

	assert.NotNil(t, server.connectionHandler)
}
