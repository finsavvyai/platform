package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/mcpoverflow/api-service/internal/models"
	"github.com/mcpoverflow/api-service/internal/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockDBService
type MockDBService struct {
	mock.Mock
}

func (m *MockDBService) GetConnector(ctx context.Context, id string) (*models.Connector, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Connector), args.Error(1)
}

func (m *MockDBService) CreateConnector(ctx context.Context, connector *models.Connector) error {
	args := m.Called(ctx, connector)
	return args.Error(0)
}

func (m *MockDBService) ListConnectors(ctx context.Context, userID string, limit, offset int) ([]*models.Connector, int64, error) {
	args := m.Called(ctx, userID, limit, offset)
	return args.Get(0).([]*models.Connector), args.Get(1).(int64), args.Error(2)
}

func (m *MockDBService) UpdateConnector(ctx context.Context, connector *models.Connector) error {
	args := m.Called(ctx, connector)
	return args.Error(0)
}

func (m *MockDBService) DeleteConnector(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestConnectorHandler_CreateConnector(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)
	mockDB := new(MockDBService)
	handler := NewConnectorHandler(mockDB) // Assuming constructor exists or we initialize struct
	
	router := gin.New()
	router.POST("/connectors", handler.CreateConnector)

	t.Run("Success", func(t *testing.T) {
		reqBody := CreateConnectorRequest{
			Name: "test-connector",
			Spec: "openapi: 3.0.0",
			Type: "openapi",
		}
		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest("POST", "/connectors", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		
		// Mock expectation: CreateConnector should be called
		mockDB.On("CreateConnector", mock.Anything, mock.MatchedBy(func(c *models.Connector) bool {
			return c.Name == "test-connector"
		})).Return(nil)

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)
		mockDB.AssertExpectations(t)
	})

	t.Run("Invalid Request", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/connectors", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")

		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestConnectorHandler_ListConnectors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mockDB := new(MockDBService)
	handler := NewConnectorHandler(mockDB)

	router := gin.New()
	router.GET("/connectors", handler.ListConnectors)

	t.Run("Success", func(t *testing.T) {
		expectedConnectors := []*models.Connector{
			{ID: uuid.MustParse("00000000-0000-0000-0000-000000000001"), Name: "Connector 1"},
			{ID: uuid.MustParse("00000000-0000-0000-0000-000000000002"), Name: "Connector 2"},
		}
		mockDB.On("ListConnectors", mock.Anything, "", 20, 0).Return(expectedConnectors, int64(2), nil)

		req, _ := http.NewRequest("GET", "/connectors", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		mockDB.AssertExpectations(t)
	})
}
