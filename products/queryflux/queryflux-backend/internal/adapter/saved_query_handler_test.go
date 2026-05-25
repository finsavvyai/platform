package adapter

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
	"github.com/stretchr/testify/assert"
)

type mockSQRepo struct {
	createFunc     func(ctx context.Context, q *domain.SavedQuery) error
	findByIDFunc   func(ctx context.Context, id string) (*domain.SavedQuery, error)
	findByUserFunc func(ctx context.Context, uid string) ([]domain.SavedQuery, error)
	updateFunc     func(ctx context.Context, q *domain.SavedQuery) error
	deleteFunc     func(ctx context.Context, id string) error
}

func (m *mockSQRepo) Create(ctx context.Context, q *domain.SavedQuery) error {
	if m.createFunc != nil {
		return m.createFunc(ctx, q)
	}
	return nil
}

func (m *mockSQRepo) FindByID(ctx context.Context, id string) (*domain.SavedQuery, error) {
	if m.findByIDFunc != nil {
		return m.findByIDFunc(ctx, id)
	}
	return nil, errors.New("not found")
}

func (m *mockSQRepo) FindByUserID(ctx context.Context, uid string) ([]domain.SavedQuery, error) {
	if m.findByUserFunc != nil {
		return m.findByUserFunc(ctx, uid)
	}
	return []domain.SavedQuery{}, nil
}

func (m *mockSQRepo) Update(ctx context.Context, q *domain.SavedQuery) error {
	if m.updateFunc != nil {
		return m.updateFunc(ctx, q)
	}
	return nil
}

func (m *mockSQRepo) Delete(ctx context.Context, id string) error {
	if m.deleteFunc != nil {
		return m.deleteFunc(ctx, id)
	}
	return nil
}

func setupSQRouter(repo *mockSQRepo) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	jwtSvc := service.NewJWTService("test-secret-sq")
	authMW := NewAuthMiddleware(jwtSvc)
	sqSvc := service.NewSavedQueryService(repo)

	api := router.Group("/api/v1")
	api.Use(authMW.Authenticate())
	NewSavedQueryHandler(sqSvc).RegisterRoutes(api)
	return router
}

func sqToken() string {
	jwtSvc := service.NewJWTService("test-secret-sq")
	t, _ := jwtSvc.GenerateAccessToken("user-1", "u@test.com")
	return t
}

func TestSavedQueryHandler_Create(t *testing.T) {
	router := setupSQRouter(&mockSQRepo{})

	body, _ := json.Marshal(domain.CreateSavedQueryRequest{
		SQL: "SELECT 1", ConnectionID: "conn-1", Name: "Test",
	})
	req, _ := http.NewRequest("POST", "/api/v1/queries", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var q domain.SavedQuery
	unwrapAPIData(t, w.Body.Bytes(), &q)
	assert.Equal(t, "Test", q.Name)
	assert.Equal(t, "user-1", q.UserID)
}

func TestSavedQueryHandler_List(t *testing.T) {
	repo := &mockSQRepo{
		findByUserFunc: func(_ context.Context, uid string) ([]domain.SavedQuery, error) {
			return []domain.SavedQuery{
				{ID: "q-1", UserID: uid},
				{ID: "q-2", UserID: uid},
			}, nil
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
	assert.Len(t, queries, 2)
}

func TestSavedQueryHandler_GetByID(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1"}, nil
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("GET", "/api/v1/queries/q-1", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSavedQueryHandler_Update(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1", Name: "Old"}, nil
		},
	}
	router := setupSQRouter(repo)

	body, _ := json.Marshal(domain.UpdateSavedQueryRequest{Name: "New"})
	req, _ := http.NewRequest("PUT", "/api/v1/queries/q-1", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var q domain.SavedQuery
	unwrapAPIData(t, w.Body.Bytes(), &q)
	assert.Equal(t, "New", q.Name)
}

func TestSavedQueryHandler_Delete(t *testing.T) {
	repo := &mockSQRepo{
		findByIDFunc: func(_ context.Context, id string) (*domain.SavedQuery, error) {
			return &domain.SavedQuery{ID: id, UserID: "user-1"}, nil
		},
	}
	router := setupSQRouter(repo)

	req, _ := http.NewRequest("DELETE", "/api/v1/queries/q-1", nil)
	req.Header.Set("Authorization", "Bearer "+sqToken())
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
}

func TestSavedQueryHandler_Unauthenticated(t *testing.T) {
	router := setupSQRouter(&mockSQRepo{})

	req, _ := http.NewRequest("GET", "/api/v1/queries", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
