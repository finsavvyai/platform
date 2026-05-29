package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/stretchr/testify/assert"
)

func setupConnRouter(repo *mockConnRepo) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	jwtSvc := service.NewJWTService("test-secret-conn")
	authMW := NewAuthMiddleware(jwtSvc)
	connSvc := service.NewConnectionService(repo, "test-encryption-key-32bytes!!")

	api := router.Group("/api/v1")
	api.Use(authMW.Authenticate())
	NewConnectionHandler(connSvc).RegisterRoutes(api)
	return router
}

func connToken() string {
	jwtSvc := service.NewJWTService("test-secret-conn")
	t, _ := jwtSvc.GenerateAccessToken("user-1", "u@test.com")
	return t
}

func TestConnectionHandler_Create(t *testing.T) {
	router := setupConnRouter(&mockConnRepo{})

	body, _ := json.Marshal(domain.CreateConnectionRequest{
		Name: "My DB", Type: "postgres", Host: "localhost",
		Port: 5432, Database: "testdb", Username: "user", Password: "pass",
	})

	req, _ := http.NewRequest("POST", "/api/v1/connections", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var conn domain.Connection
	unwrapAPIData(t, w.Body.Bytes(), &conn)
	assert.Equal(t, "My DB", conn.Name)
	assert.Equal(t, "user-1", conn.UserID)
}

func TestConnectionHandler_Create_BadJSON(t *testing.T) {
	router := setupConnRouter(&mockConnRepo{})

	req, _ := http.NewRequest("POST", "/api/v1/connections", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConnectionHandler_List(t *testing.T) {
	repo := &mockConnRepo{
		findByUserFunc: func(_ context.Context, userID string) ([]domain.Connection, error) {
			return []domain.Connection{
				{ID: "c-1", UserID: userID, Name: "DB 1"},
				{ID: "c-2", UserID: userID, Name: "DB 2"},
			}, nil
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/connections", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var conns []domain.Connection
	unwrapAPIData(t, w.Body.Bytes(), &conns)
	assert.Len(t, conns, 2)
}

func TestConnectionHandler_GetByID(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1", Name: "Test"}, nil
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/connections/c-1", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestConnectionHandler_GetByID_Forbidden(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "other-user"}, nil
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/connections/c-1", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestConnectionHandler_Update(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1", Name: "Old"}, nil
		},
	}
	router := setupConnRouter(repo)

	body, _ := json.Marshal(domain.UpdateConnectionRequest{Name: "New"})
	req, _ := http.NewRequest("PUT", "/api/v1/connections/c-1", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var conn domain.Connection
	unwrapAPIData(t, w.Body.Bytes(), &conn)
	assert.Equal(t, "New", conn.Name)
}

func TestConnectionHandler_Delete(t *testing.T) {
	deleted := false
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.Connection, error) {
			return &domain.Connection{ID: id, UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, id string) error {
			deleted = true
			return nil
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("DELETE", "/api/v1/connections/c-1", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.True(t, deleted)
}

func TestConnectionHandler_Unauthenticated(t *testing.T) {
	router := setupConnRouter(&mockConnRepo{})

	req, _ := http.NewRequest("GET", "/api/v1/connections", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
