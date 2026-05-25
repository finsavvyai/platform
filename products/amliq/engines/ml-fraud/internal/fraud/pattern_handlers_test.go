package fraud

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockPatternSharingService mocks PatternSharingService.
type MockPatternSharingService struct {
	mock.Mock
}

func (m *MockPatternSharingService) ContributePatterns(c *PatternContribution) error {
	return m.Called(c).Error(0)
}
func (m *MockPatternSharingService) GetAggregatePatterns(tenantID string, threshold int) ([]SharedPattern, error) {
	args := m.Called(tenantID, threshold)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]SharedPattern), args.Error(1)
}
func (m *MockPatternSharingService) GetTenantConfig(tenantID string) (*PatternSharingConfig, error) {
	args := m.Called(tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*PatternSharingConfig), args.Error(1)
}
func (m *MockPatternSharingService) UpdateTenantConfig(config *PatternSharingConfig) error {
	return m.Called(config).Error(0)
}
func (m *MockPatternSharingService) GetAggregateStats() (*AggregatePatternStats, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*AggregatePatternStats), args.Error(1)
}

func setupPatternRouter(svc PatternSharingService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewPatternHandler(svc)
	g := r.Group("/v1/patterns")
	g.GET("/aggregate", h.GetAggregatePatterns)
	g.POST("/contribute", h.ContributePatterns)
	g.GET("/config", h.GetTenantConfig)
	g.PUT("/config", h.UpdateTenantConfig)
	g.GET("/stats", h.GetAggregateStats)
	return r
}

func TestGetAggregatePatterns_Success(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("GetAggregatePatterns", "t1", 5).Return(
		[]SharedPattern{{PatternType: "velocity", TenantCount: 6}}, nil)

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/aggregate?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestGetAggregatePatterns_MissingTenant(t *testing.T) {
	r := setupPatternRouter(new(MockPatternSharingService))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/aggregate", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetAggregatePatterns_NotOptedIn(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("GetAggregatePatterns", "t1", 5).Return(nil, fmt.Errorf("tenant t1 has not opted in"))

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/aggregate?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestContributePatterns_Success(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("ContributePatterns", mock.Anything).Return(nil)

	body, _ := json.Marshal(PatternContribution{
		TenantID: "t1",
		Patterns: []SharedPattern{{PatternType: "velocity", Frequency: 5}},
	})

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/patterns/contribute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestContributePatterns_NotOptedIn(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("ContributePatterns", mock.Anything).Return(fmt.Errorf("tenant t1 has not opted in"))

	body, _ := json.Marshal(PatternContribution{
		TenantID: "t1",
		Patterns: []SharedPattern{{PatternType: "velocity", Frequency: 5}},
	})

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/v1/patterns/contribute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)
}

func TestGetTenantConfig_Success(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("GetTenantConfig", "t1").Return(&PatternSharingConfig{
		TenantID: "t1", OptIn: true, AnonymizationThreshold: 5, SharingScope: "industry_wide",
	}, nil)

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/config?tenant_id=t1", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetTenantConfig_MissingTenant(t *testing.T) {
	r := setupPatternRouter(new(MockPatternSharingService))
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/config", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateTenantConfig_Success(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("UpdateTenantConfig", mock.Anything).Return(nil)

	body, _ := json.Marshal(PatternSharingConfig{
		TenantID: "t1", OptIn: true, AnonymizationThreshold: 5, SharingScope: "industry_wide",
	})

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, "/v1/patterns/config", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestUpdateTenantConfig_ValidationError(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("UpdateTenantConfig", mock.Anything).Return(fmt.Errorf("invalid config"))

	body, _ := json.Marshal(PatternSharingConfig{TenantID: "t1", AnonymizationThreshold: 1})
	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPut, "/v1/patterns/config", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetAggregateStats_Success(t *testing.T) {
	svc := new(MockPatternSharingService)
	svc.On("GetAggregateStats").Return(&AggregatePatternStats{
		TotalPatterns: 10, ContributingTenants: 5,
	}, nil)

	r := setupPatternRouter(svc)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/v1/patterns/stats", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Contains(t, body, "stats")
}
