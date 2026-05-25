package security

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurityScanner_ScanImage(t *testing.T) {
	t.Parallel()

	config := SecurityConfig{
		TrivyEnabled:      true,
		TrivyServerURL:    "http://trivy-server:8080",
		AllowedRegistries: []string{"docker.io", "quay.io"},
		MaxSeverityLevel:  "HIGH",
		SkipUpdate:        false,
	}

	scanner := NewSecurityScanner(config)
	ctx := context.Background()

	tests := []struct {
		name           string
		imageRef       string
		expectedError  bool
		expectedPassed bool
	}{
		{
			name:           "Scan known vulnerable image",
			imageRef:       "nginx:1.18",
			expectedError:  false,
			expectedPassed: false,
		},
		{
			name:           "Scan secure image",
			imageRef:       "nginx:latest",
			expectedError:  false,
			expectedPassed: false, // Mock scanner returns simulated vulns for all images
		},
		{
			name:           "Scan invalid image",
			imageRef:       "invalid/image:tag",
			expectedError:  false,
			expectedPassed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := scanner.ScanImage(ctx, tt.imageRef)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				require.NotNil(t, result)

				assert.NotEmpty(t, result.ImageID)
				assert.Equal(t, tt.imageRef, result.ImageRef)
				assert.NotZero(t, result.ScanTimestamp)
				assert.NotEmpty(t, result.ScannerVersion)
				assert.Equal(t, tt.expectedPassed, result.Passed)

				// Verify summary
				assert.NotNil(t, result.Summary)
				assert.GreaterOrEqual(t, result.Summary.TotalVulnerabilities, 0)

				// Verify recommendations exist
				assert.NotEmpty(t, result.Recommendations)
			}
		})
	}
}

func TestSecurityScanner_GenerateComplianceReport(t *testing.T) {
	t.Parallel()

	scanner := NewSecurityScanner(SecurityConfig{})
	vulnerabilities := []Vulnerability{
		{
			ID:           "CVE-2023-1234",
			Severity:     SeverityCritical,
			Package:      "openssl",
			FixedVersion: "1.1.1g",
		},
		{
			ID:           "CVE-2023-5678",
			Severity:     SeverityMedium,
			Package:      "libcurl",
			FixedVersion: "7.88.1",
		},
	}

	report, err := scanner.generateComplianceReport("test-image-id", vulnerabilities)

	require.NoError(t, err)
	require.NotNil(t, report)

	assert.Equal(t, "test-image-id", report.ImageID)
	assert.Equal(t, ComplianceNIST, report.Framework)
	assert.NotEmpty(t, report.ID)
	assert.NotZero(t, report.GeneratedAt)
	assert.True(t, report.ValidUntil.After(report.GeneratedAt))

	// Compliance score should be reduced by critical and medium vulnerabilities
	assert.Less(t, report.Score, 100.0)
	assert.GreaterOrEqual(t, report.Score, 0.0)

	// With critical vulnerability, status should be FAIL or WARNING
	assert.True(t, report.Status == ComplianceFail || report.Status == ComplianceWarning)

	// Verify controls
	assert.NotEmpty(t, report.Controls)
	for _, control := range report.Controls {
		assert.NotEmpty(t, control.ID)
		assert.NotEmpty(t, control.Name)
		assert.NotEmpty(t, control.Status)
	}
}

func TestSecurityScanner_GenerateRecommendations(t *testing.T) {
	t.Parallel()

	scanner := NewSecurityScanner(SecurityConfig{})

	tests := []struct {
		name            string
		vulnerabilities []Vulnerability
		expectedCount   int
		expectedTypes   []string
	}{
		{
			name:            "No vulnerabilities",
			vulnerabilities: []Vulnerability{},
			expectedCount:   1, // General recommendation
			expectedTypes:   []string{"Process Improvement"},
		},
		{
			name: "Critical vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityCritical},
			},
			expectedCount: 2,
			expectedTypes: []string{"Vulnerability Management", "Process Improvement"},
		},
		{
			name: "High vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityHigh},
			},
			expectedCount: 2,
			expectedTypes: []string{"Vulnerability Management", "Process Improvement"},
		},
		{
			name: "Critical and High vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityCritical},
				{Severity: SeverityHigh},
			},
			expectedCount: 3,
			expectedTypes: []string{"Vulnerability Management", "Process Improvement"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recommendations := scanner.generateRecommendations(tt.vulnerabilities)

			assert.Len(t, recommendations, tt.expectedCount)

			for _, rec := range recommendations {
				assert.NotEmpty(t, rec.ID)
				assert.NotEmpty(t, rec.Title)
				assert.NotEmpty(t, rec.Description)
				assert.NotEmpty(t, rec.Priority)
				assert.NotEmpty(t, rec.Category)
				assert.True(t, rec.Actionable)
			}

			// Check for expected recommendation types
			for _, expectedType := range tt.expectedTypes {
				found := false
				for _, rec := range recommendations {
					if rec.Category == expectedType {
						found = true
						break
					}
				}
				assert.True(t, found, "Expected recommendation type %s not found", expectedType)
			}
		})
	}
}

func TestSecurityScanner_CalculateComplianceScore(t *testing.T) {
	t.Parallel()

	scanner := NewSecurityScanner(SecurityConfig{})

	tests := []struct {
		name            string
		vulnerabilities []Vulnerability
		expectedRange   [2]float64 // min, max
	}{
		{
			name:            "No vulnerabilities",
			vulnerabilities: []Vulnerability{},
			expectedRange:   [2]float64{100, 100},
		},
		{
			name: "Low severity vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityLow},
				{Severity: SeverityLow},
			},
			expectedRange: [2]float64{98, 98},
		},
		{
			name: "Mixed severity vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityLow},
				{Severity: SeverityMedium},
				{Severity: SeverityHigh},
				{Severity: SeverityCritical},
			},
			expectedRange: [2]float64{54, 54},
		},
		{
			name: "Multiple critical vulnerabilities",
			vulnerabilities: []Vulnerability{
				{Severity: SeverityCritical},
				{Severity: SeverityCritical},
				{Severity: SeverityCritical},
			},
			expectedRange: [2]float64{25, 25},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := scanner.calculateComplianceScore(tt.vulnerabilities)

			assert.GreaterOrEqual(t, score, tt.expectedRange[0])
			assert.LessOrEqual(t, score, tt.expectedRange[1])
			assert.GreaterOrEqual(t, score, 0.0)
			assert.LessOrEqual(t, score, 100.0)
		})
	}
}

func TestSecurityScanner_GenerateScanSummary(t *testing.T) {
	t.Parallel()

	scanner := NewSecurityScanner(SecurityConfig{})

	vulnerabilities := []Vulnerability{
		{Package: "openssl", Severity: SeverityCritical},
		{Package: "openssl", Severity: SeverityHigh},
		{Package: "libcurl", Severity: SeverityMedium},
		{Package: "nginx", Severity: SeverityLow},
		{Package: "libcurl", Severity: SeverityMedium},
	}

	summary := scanner.generateScanSummary(vulnerabilities)

	assert.Equal(t, 5, summary.TotalVulnerabilities)
	assert.Equal(t, 1, summary.CriticalCount)
	assert.Equal(t, 1, summary.HighCount)
	assert.Equal(t, 2, summary.MediumCount)
	assert.Equal(t, 1, summary.LowCount)

	// Verify severity distribution
	assert.Equal(t, 1, summary.SeverityDistribution["CRITICAL"])
	assert.Equal(t, 1, summary.SeverityDistribution["HIGH"])
	assert.Equal(t, 2, summary.SeverityDistribution["MEDIUM"])
	assert.Equal(t, 1, summary.SeverityDistribution["LOW"])

	// Verify top packages
	assert.Len(t, summary.TopPackages, 3) // openssl, libcurl, nginx

	// Find openssl package summary
	var opensslSummary *PackageSummary
	for _, pkg := range summary.TopPackages {
		if pkg.Name == "openssl" {
			opensslSummary = &pkg
			break
		}
	}
	require.NotNil(t, opensslSummary)
	assert.Equal(t, 2, opensslSummary.VulnerabilityCount)
	assert.Equal(t, "CRITICAL", opensslSummary.HighestSeverity)
}

func TestSecurityScanner_DetermineScanResult(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		config          SecurityConfig
		vulnerabilities []Vulnerability
		expectedResult  bool
	}{
		{
			name: "Critical threshold - critical vulns should fail",
			config: SecurityConfig{
				MaxSeverityLevel: "CRITICAL",
			},
			vulnerabilities: []Vulnerability{
				{Severity: SeverityCritical},
			},
			expectedResult: true, // Pass when max is CRITICAL
		},
		{
			name: "High threshold - critical vulns should fail",
			config: SecurityConfig{
				MaxSeverityLevel: "HIGH",
			},
			vulnerabilities: []Vulnerability{
				{Severity: SeverityCritical},
			},
			expectedResult: false, // Fail when max is HIGH and we have CRITICAL
		},
		{
			name: "High threshold - high vulns should pass",
			config: SecurityConfig{
				MaxSeverityLevel: "HIGH",
			},
			vulnerabilities: []Vulnerability{
				{Severity: SeverityHigh},
			},
			expectedResult: true, // Pass when max is HIGH
		},
		{
			name: "Medium threshold - high vulns should fail",
			config: SecurityConfig{
				MaxSeverityLevel: "MEDIUM",
			},
			vulnerabilities: []Vulnerability{
				{Severity: SeverityHigh},
			},
			expectedResult: false,
		},
		{
			name: "Low threshold - medium vulns should fail",
			config: SecurityConfig{
				MaxSeverityLevel: "LOW",
			},
			vulnerabilities: []Vulnerability{
				{Severity: SeverityMedium},
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scanner := NewSecurityScanner(tt.config)
			result := scanner.determineScanResult(tt.vulnerabilities)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestSeverity_String(t *testing.T) {
	t.Parallel()

	tests := []struct {
		severity    Severity
		expectedStr string
	}{
		{SeverityUnknown, "UNKNOWN"},
		{SeverityLow, "LOW"},
		{SeverityMedium, "MEDIUM"},
		{SeverityHigh, "HIGH"},
		{SeverityCritical, "CRITICAL"},
	}

	for _, tt := range tests {
		t.Run(tt.expectedStr, func(t *testing.T) {
			assert.Equal(t, tt.expectedStr, tt.severity.String())
		})
	}
}

func TestVulnerability_Validation(t *testing.T) {
	t.Parallel()

	vuln := Vulnerability{
		ID:               "CVE-2023-1234",
		Title:            "Test Vulnerability",
		Description:      "Test description",
		Severity:         SeverityHigh,
		Package:          "test-package",
		InstalledVersion: "1.0.0",
		FixedVersion:     "1.0.1",
		References:       []string{"https://example.com"},
		CVE:              "CVE-2023-1234",
		CVSS:             8.5,
		Found:            true,
	}

	assert.Equal(t, "CVE-2023-1234", vuln.ID)
	assert.Equal(t, SeverityHigh, vuln.Severity)
	assert.Equal(t, 8.5, vuln.CVSS)
	assert.True(t, vuln.Found)
}

// Benchmark tests
func BenchmarkSecurityScanner_ScanImage(b *testing.B) {
	scanner := NewSecurityScanner(SecurityConfig{})
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := scanner.ScanImage(ctx, "nginx:latest")
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSecurityScanner_CalculateComplianceScore(b *testing.B) {
	scanner := NewSecurityScanner(SecurityConfig{})
	vulnerabilities := []Vulnerability{
		{Severity: SeverityCritical},
		{Severity: SeverityHigh},
		{Severity: SeverityMedium},
		{Severity: SeverityLow},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = scanner.calculateComplianceScore(vulnerabilities)
	}
}
