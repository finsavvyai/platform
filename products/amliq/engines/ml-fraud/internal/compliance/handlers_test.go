package compliance

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handlerMockProvider satisfies EvidenceProvider for handler tests.
type handlerMockProvider struct{}

func (m *handlerMockProvider) Collect(
	_ context.Context, _ string, _ EvidenceType,
) ([]EvidenceItem, error) {
	return []EvidenceItem{
		{Type: AuditLog, Source: "test", Data: "test-data", Verified: true},
	}, nil
}

// setupTestRouter creates a gin router with compliance endpoints.
func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	registry := NewInMemoryControlRegistry()
	collector := NewEvidenceCollector()
	collector.RegisterProvider(AuditLog, &handlerMockProvider{})
	collector.RegisterProvider(RBACConfig, &handlerMockProvider{})
	collector.RegisterProvider(EncryptionConf, &handlerMockProvider{})
	collector.RegisterProvider(CICDLog, &handlerMockProvider{})
	collector.RegisterProvider(MonitoringAlert, &handlerMockProvider{})

	generator := NewReportGenerator(registry, collector)
	handler := NewComplianceHandler(registry, generator)

	r := gin.New()
	g := r.Group("/compliance")
	handler.RegisterRoutes(g)
	return r
}

func TestListFrameworks(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/frameworks", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string][]string
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)

	frameworks := body["frameworks"]
	assert.Contains(t, frameworks, string(SOC2))
	assert.Contains(t, frameworks, string(PCI_DSS))
}

func TestListControls_SOC2(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/controls?framework=SOC2", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var body map[string][]ControlDefinition
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.NotEmpty(t, body["controls"])
}

func TestListControls_InvalidFramework(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/controls?framework=INVALID", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var body map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &body)
	require.NoError(t, err)
	assert.Contains(t, body["error"], "invalid framework")
}

func TestListControls_MissingFramework(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/controls", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetControlEvidence(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/controls/CC6.1/evidence", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestGetControlEvidence_NotFound(t *testing.T) {
	router := setupTestRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/controls/MISSING/evidence", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestGetTenantID_Default(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/", nil)

	tid := getTenantID(c)
	assert.Equal(t, "default", tid)
}

func TestGetTenantID_FromHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("X-Tenant-ID", "my-tenant")

	tid := getTenantID(c)
	assert.Equal(t, "my-tenant", tid)
}
