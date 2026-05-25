package compliance

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupRoutesTestRouter uses RegisterComplianceRoutes to wire endpoints.
func setupRoutesTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)

	registry := NewInMemoryControlRegistry()
	collector := NewEvidenceCollector()
	collector.RegisterProvider(AuditLog, &handlerMockProvider{})
	collector.RegisterProvider(RBACConfig, &handlerMockProvider{})
	collector.RegisterProvider(EncryptionConf, &handlerMockProvider{})
	collector.RegisterProvider(CICDLog, &handlerMockProvider{})
	collector.RegisterProvider(MonitoringAlert, &handlerMockProvider{})

	generator := NewReportGenerator(registry, collector)

	r := gin.New()
	g := r.Group("/compliance")
	RegisterComplianceRoutes(g, registry, generator)
	return r
}

// expectedRoute describes a route that must be registered.
type expectedRoute struct {
	Method string
	Path   string
}

func TestRegisterComplianceRoutes_AllRoutesRegistered(t *testing.T) {
	router := setupRoutesTestRouter()

	expected := []expectedRoute{
		{http.MethodGet, "/compliance/frameworks"},
		{http.MethodGet, "/compliance/controls"},
		{http.MethodGet, "/compliance/controls/:id/evidence"},
		{http.MethodPost, "/compliance/evidence/collect"},
		{http.MethodGet, "/compliance/report"},
		{http.MethodGet, "/compliance/dashboard"},
		{http.MethodPost, "/compliance/controls/:id/override"},
	}

	routes := router.Routes()
	registered := make(map[string]bool, len(routes))
	for _, ri := range routes {
		registered[ri.Method+":"+ri.Path] = true
	}

	for _, exp := range expected {
		key := exp.Method + ":" + exp.Path
		assert.True(t, registered[key],
			"expected route %s %s to be registered", exp.Method, exp.Path)
	}
}

func TestRegisterComplianceRoutes_ReturnsHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	registry := NewInMemoryControlRegistry()
	collector := NewEvidenceCollector()
	generator := NewReportGenerator(registry, collector)

	r := gin.New()
	g := r.Group("/compliance")
	handler := RegisterComplianceRoutes(g, registry, generator)

	assert.NotNil(t, handler)
}

func TestRegisterComplianceRoutes_RouteCount(t *testing.T) {
	router := setupRoutesTestRouter()
	assert.Equal(t, 7, len(router.Routes()),
		"expected exactly 7 compliance routes")
}

// Integration test: list frameworks -> list controls -> generate report.
func TestIntegration_FrameworksToControlsToReport(t *testing.T) {
	router := setupRoutesTestRouter()

	// Step 1: List frameworks.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/frameworks", nil)
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "list frameworks should succeed")

	var fwBody map[string][]string
	err := json.Unmarshal(w.Body.Bytes(), &fwBody)
	require.NoError(t, err)

	frameworks := fwBody["frameworks"]
	require.NotEmpty(t, frameworks, "should return at least one framework")

	// Pick the first framework for subsequent calls.
	chosenFW := frameworks[0]

	// Step 2: List controls for the chosen framework.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(
		http.MethodGet,
		"/compliance/controls?framework="+chosenFW,
		nil,
	)
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "list controls should succeed")

	var ctrlBody map[string][]ControlDefinition
	err = json.Unmarshal(w.Body.Bytes(), &ctrlBody)
	require.NoError(t, err)

	controls := ctrlBody["controls"]
	require.NotEmpty(t, controls, "should return controls for framework")

	// Step 3: Generate report for the same framework.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(
		http.MethodGet,
		"/compliance/report?framework="+chosenFW,
		nil,
	)
	req.Header.Set("X-Tenant-ID", "integration-tenant")
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "generate report should succeed")

	var report ComplianceReport
	err = json.Unmarshal(w.Body.Bytes(), &report)
	require.NoError(t, err)

	assert.Equal(t, ComplianceFramework(chosenFW), report.Framework)
	assert.Equal(t, "integration-tenant", report.TenantID)
	assert.Greater(t, report.TotalControls, 0)
	assert.GreaterOrEqual(t, report.Score, float64(0))
}

// Integration test: list frameworks -> list controls -> get evidence for
// the first control returned.
func TestIntegration_FrameworksToControlsToEvidence(t *testing.T) {
	router := setupRoutesTestRouter()

	// Step 1: List frameworks and pick one.
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/compliance/frameworks", nil)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var fwBody map[string][]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &fwBody))
	require.NotEmpty(t, fwBody["frameworks"])
	chosenFW := fwBody["frameworks"][0]

	// Step 2: List controls.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(
		http.MethodGet,
		"/compliance/controls?framework="+chosenFW,
		nil,
	)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var ctrlBody map[string][]ControlDefinition
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ctrlBody))
	require.NotEmpty(t, ctrlBody["controls"])

	controlID := ctrlBody["controls"][0].Control.ID

	// Step 3: Get evidence for the first control.
	w = httptest.NewRecorder()
	req, _ = http.NewRequest(
		http.MethodGet,
		"/compliance/controls/"+controlID+"/evidence",
		nil,
	)
	router.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var evidenceBody map[string][]EvidenceItem
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &evidenceBody))
	assert.NotNil(t, evidenceBody["evidence"])
}
