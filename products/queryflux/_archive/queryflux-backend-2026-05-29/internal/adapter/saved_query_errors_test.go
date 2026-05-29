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

func TestSavedQueryHandler_Create_BadJSON(t *testing.T) {
	router := setupSQRouter(&mockSQRepo{})

	req, _ := http.NewRequest("POST", "/api/v1/queries", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSavedQueryHandler_Create_ServiceError(t *testing.T) {
	repo := &mockSQRepo{
		createFunc: func(_ context.Context, _ *domain.SavedQuery) error {
			return errors.New("db failure")
		},
	}
	router := setupSQRouter(repo)

	body := []byte(`{"sql":"SELECT 1","connectionId":"c-1"}`)
	req, _ := http.NewRequest("POST", "/api/v1/queries", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSavedQueryHandler_List_ServiceError(t *testing.T) {
	repo := &mockSQRepo{
		findByUserFunc: func(_ context.Context, _ string) ([]domain.SavedQuery, error) {
			return nil, errors.New("db failure")
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/queries", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSavedQueryHandler_GetByID_NotFound(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.SavedQuery, error) {
			return nil, errors.New("not found")
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/queries/q-1", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSavedQueryHandler_GetByID_Forbidden(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: "q-1", UserID: "other-user"}, nil
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/queries/q-1", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestSavedQueryHandler_Update_BadJSON(t *testing.T) {
	router := setupSQRouter(&mockSQRepo{})

	req, _ := http.NewRequest("PUT", "/api/v1/queries/q-1", bytes.NewBufferString("{bad"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestSavedQueryHandler_Delete_ServiceError(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: "q-1", UserID: "user-1"}, nil
		},
		deleteFunc: func(_ context.Context, _ string) error {
			return errors.New("db failure")
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("DELETE", "/api/v1/queries/q-1", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSavedQueryHandler_Update_ServiceError(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, _ string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: "q-1", UserID: "user-1"}, nil
		},
		updateFunc: func(_ context.Context, _ *domain.SavedQuery) error {
			return errors.New("db failure")
		},
	}
	router := setupSQRouter(repo)

	body := []byte(`{"name":"Updated"}`)
	req, _ := http.NewRequest("PUT", "/api/v1/queries/q-1", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestSavedQueryHandler_List_NilResult(t *testing.T) {
	repo := &mockSQRepo{
		findByUserFunc: func(_ context.Context, _ string) ([]domain.SavedQuery, error) {
			return nil, nil
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/queries", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var queries []domain.SavedQuery
	unwrapAPIData(t, w.Body.Bytes(), &queries)
	assert.Len(t, queries, 0)
}
