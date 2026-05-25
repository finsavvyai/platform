package compliance

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupComplianceRouter creates a gin router with real registry and generator.
func setupComplianceRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	registry := NewInMemoryControlRegistry()
	collector := NewEvidenceCollector()
	generator := NewReportGenerator(registry, collector)

	r := gin.New()
	group := r.Group("/compliance")
	RegisterComplianceRoutes(group, registry, generator)
	return r
}

func TestIntegration_FullComplianceFlow(t *testing.T) {
	router := setupComplianceRouter()

	// Step 1: List frameworks
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/frameworks", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var fwResp map[string][]string
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &fwResp))
	assert.NotEmpty(t, fwResp["frameworks"])

	// Step 2: Get controls for SOC2
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/compliance/controls?framework=SOC2", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var ctrlResp map[string][]ControlDefinition
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ctrlResp))
	assert.NotEmpty(t, ctrlResp["controls"])

	// Step 3: Generate report for SOC2
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/compliance/report?framework=SOC2", nil)
	req.Header.Set("X-Tenant-ID", "tenant-int")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var report ComplianceReport
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	assert.Equal(t, SOC2, report.Framework)
	assert.Greater(t, report.TotalControls, 0)
}

func TestIntegration_ReportGenerationReturnsScore(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/report?framework=SOC2", nil)
	req.Header.Set("X-Tenant-ID", "tenant-score")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var report ComplianceReport
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &report))
	// Score is calculated: it should be a valid percentage (0-100)
	assert.GreaterOrEqual(t, report.Score, 0.0)
	assert.LessOrEqual(t, report.Score, 100.0)
	assert.Equal(t, report.TotalControls, len(report.Controls))
}

func TestIntegration_DashboardStatsAggregates(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/dashboard", nil)
	req.Header.Set("X-Tenant-ID", "tenant-dash")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var stats ComplianceDashboardStats
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &stats))

	// Dashboard should aggregate multiple frameworks
	assert.NotEmpty(t, stats.Frameworks)
	assert.Greater(t, stats.TotalControls, 0)
	assert.GreaterOrEqual(t, stats.OverallScore, 0.0)
	assert.LessOrEqual(t, stats.OverallScore, 100.0)

	// Verify compliant + non-compliant = total
	assert.Equal(t, stats.TotalControls,
		stats.CompliantControls+stats.NonCompliantControls)
}

func TestIntegration_PCI_DSS_Controls(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/controls?framework=PCI_DSS", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string][]ControlDefinition
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.NotEmpty(t, resp["controls"])

	// Verify all returned controls belong to PCI_DSS
	for _, def := range resp["controls"] {
		assert.Equal(t, PCI_DSS, def.Control.Framework)
	}
}

func TestIntegration_InvalidFrameworkReturns400(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/controls?framework=INVALID", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestIntegration_MissingFrameworkReturns400(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/report", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestIntegration_OverrideControlStatus(t *testing.T) {
	router := setupComplianceRouter()

	// First, get controls to find a valid control ID
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/compliance/controls?framework=SOC2", nil)
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var ctrlResp map[string][]ControlDefinition
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &ctrlResp))
	require.NotEmpty(t, ctrlResp["controls"])
	controlID := ctrlResp["controls"][0].Control.ID

	// Override the control status
	overrideBody, _ := json.Marshal(map[string]string{
		"status": "COMPLIANT",
		"reason": "Manual verification completed",
	})
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("POST", "/compliance/controls/"+controlID+"/override",
		bytes.NewReader(overrideBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var overrideResp map[string]interface{}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &overrideResp))
	assert.Equal(t, controlID, overrideResp["control_id"])
	assert.Equal(t, "COMPLIANT", overrideResp["new_status"])
	assert.Equal(t, "control status overridden", overrideResp["message"])
}

func TestIntegration_OverrideNonexistentControl(t *testing.T) {
	router := setupComplianceRouter()

	body, _ := json.Marshal(map[string]string{
		"status": "COMPLIANT",
		"reason": "test",
	})
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/compliance/controls/nonexistent/override",
		bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestIntegration_EvidenceCollectAccepted(t *testing.T) {
	router := setupComplianceRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/compliance/evidence/collect", nil)
	req.Header.Set("X-Tenant-ID", "tenant-evid")
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusAccepted, w.Code)
}
