package adapter

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/queryflux/backend/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestConnectionHandler_List_ServiceError(t *testing.T) {
	repo := &mockConnRepo{
		findByUserFunc: func(_ context.Context, _ string) ([]domain.Connection, error) {
			return nil, errors.New("db failure")
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/connections", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestConnectionHandler_GetByID_NotFound(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return nil, errors.New("not found")
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/connections/c-1", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestConnectionHandler_Update_BadJSON(t *testing.T) {
	router := setupConnRouter(&mockConnRepo{})

	req, _ := http.NewRequest("PUT", "/api/v1/connections/c-1", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestConnectionHandler_Create_ServiceError(t *testing.T) {
	repo := &mockConnRepo{
		createFunc: func(_ context.Context, _ *domain.Connection) error {
			return errors.New("db failure")
		},
	}
	router := setupConnRouter(repo)

	body := []byte(`{"name":"DB","type":"postgres","host":"localhost","port":5432,"database":"test","username":"u","password":"p"}`)
	req, _ := http.NewRequest("POST", "/api/v1/connections", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestConnectionHandler_Delete_ServiceError(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return &domain.Connection{ID: "c-1", UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, _ string) error {
			return errors.New("db failure")
		},
	}
	router := setupConnRouter(repo)

	req, _ := http.NewRequest("DELETE", "/api/v1/connections/c-1", nil)
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestConnectionHandler_List_NilResult(t *testing.T) {
	repo := &mockConnRepo{
		findByUserFunc: func(_ context.Context, _ string) ([]domain.Connection, error) {
			return nil, nil
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
	assert.Len(t, conns, 0)
}

func TestConnectionHandler_Update_ServiceError(t *testing.T) {
	repo := &mockConnRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.Connection, error) {
			return &domain.Connection{ID: "c-1", UserID: "user-1"}, nil
		},
		updateFunc: func(_ context.Context, _ *domain.Connection) error {
			return errors.New("db failure")
		},
	}
	router := setupConnRouter(repo)

	body := []byte(`{"name":"Updated"}`)
	req, _ := http.NewRequest("PUT", "/api/v1/connections/c-1", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+connToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}
