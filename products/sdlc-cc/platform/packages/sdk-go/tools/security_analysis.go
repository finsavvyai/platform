package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// SecurityIssue represents a potential security vulnerability
type SecurityIssue struct {
	Type           string `json:"type"`
	Severity       string `json:"severity"`
	File           string `json:"file"`
	Line           int    `json:"line"`
	Code           string `json:"code"`
	Description    string `json:"description"`
	Recommendation string `json:"recommendation"`
}

// SecurityReport contains the complete security analysis
type SecurityReport struct {
	TotalIssues    int             `json:"total_issues"`
	CriticalIssues int             `json:"critical_issues"`
	HighIssues     int             `json:"high_issues"`
	MediumIssues   int             `json:"medium_issues"`
	LowIssues      int             `json:"low_issues"`
	Issues         []SecurityIssue `json:"issues"`
	ScanTime       string          `json:"scan_time"`
	Package        string          `json:"package"`
}

// Security patterns to check for
var securityPatterns = []struct {
	pattern        *regexp.Regexp
	severity       string
	issueType      string
	description    string
	recommendation string
}{
	{
		pattern:        regexp.MustCompile(`(?i)password\s*=\s*["'][^"']+["']`),
		severity:       "critical",
		issueType:      "hardcoded_password",
		description:    "Hardcoded password detected in source code",
		recommendation: "Use environment variables or secure credential management",
	},
	{
		pattern:        regexp.MustCompile(`(?i)api[_-]?key\s*=\s*["'][^"']+["']`),
		severity:       "critical",
		issueType:      "hardcoded_api_key",
		description:    "Hardcoded API key detected in source code",
		recommendation: "Use environment variables or secure credential management",
	},
	{
		pattern:        regexp.MustCompile(`(?i)secret[_-]?key\s*=\s*["'][^"']+["']`),
		severity:       "critical",
		issueType:      "hardcoded_secret",
		description:    "Hardcoded secret key detected in source code",
		recommendation: "Use environment variables or secure credential management",
	},
	{
		pattern:        regexp.MustCompile(`(?i)token\s*=\s*["'][^"']+["']`),
		severity:       "high",
		issueType:      "hardcoded_token",
		description:    "Hardcoded token detected in source code",
		recommendation: "Use environment variables or secure credential management",
	},
	{
		pattern:        regexp.MustCompile(`fmt\.Print.*password`),
		severity:       "high",
		issueType:      "password_logging",
		description:    "Password being printed to console",
		recommendation: "Avoid logging sensitive information",
	},
	{
		pattern:        regexp.MustCompile(`log\.(Print|Fatal|Panic).*password`),
		severity:       "high",
		issueType:      "password_logging",
		description:    "Password being logged",
		recommendation: "Avoid logging sensitive information",
	},
	{
		pattern:        regexp.MustCompile(`exec\.Command|os\.Exec|syscall\.Exec`),
		severity:       "medium",
		issueType:      "command_injection",
		description:    "Use of command execution functions",
		recommendation: "Validate and sanitize all input to command execution",
	},
	{
		pattern:        regexp.MustCompile(`sql\.Query|db\.Query|database/sql\.Query`),
		severity:       "medium",
		issueType:      "sql_injection_risk",
		description:    "Direct SQL query execution",
		recommendation: "Use parameterized queries or prepared statements",
	},
	{
		pattern:        regexp.MustCompile(`http\.Get|http\.Post|http\.Do.*http\.Request`),
		severity:       "medium",
		issueType:      "insecure_http",
		description:    "HTTP request without TLS verification",
		recommendation: "Use HTTPS and proper TLS verification",
	},
	{
		pattern:        regexp.MustCompile(`tls\.Config.*InsecureSkipVerify\s*=\s*true`),
		severity:       "high",
		issueType:      "insecure_tls",
		description:    "TLS certificate verification disabled",
		recommendation: "Always verify TLS certificates",
	},
	{
		pattern:        regexp.MustCompile(`rand\.Seed.*time\.Now\(\)\.UnixNano\(\)`),
		severity:       "low",
		issueType:      "weak_randomness",
		description:    "Weak random number generation",
		recommendation: "Use crypto/rand for security-sensitive operations",
	},
	{
		pattern:        regexp.MustCompile(`md5\.New|sha1\.New`),
		severity:       "medium",
		issueType:      "weak_hashing",
		description:    "Use of weak cryptographic hash functions",
		recommendation: "Use SHA-256 or stronger hash functions",
	},
	{
		pattern:        regexp.MustCompile(`json\.Unmarshal.*interface{}`),
		severity:       "medium",
		issueType:      "unsafe_json_unmarshaling",
		description:    "Unsafe JSON unmarshaling without type validation",
		recommendation: "Validate JSON input types before unmarshaling",
	},
	{
		pattern:        regexp.MustCompile(`(?i)md5|sha1.*password`),
		severity:       "critical",
		issueType:      "weak_password_hashing",
		description:    "Use of weak password hashing algorithms",
		recommendation: "Use bcrypt, scrypt, or Argon2 for password hashing",
	},
	{
		pattern:        regexp.MustCompile(`(?i)rsa\.(GenerateKey|Encrypt|Decrypt).*1024`),
		severity:       "high",
		issueType:      "weak_rsa_key",
		description:    "Use of weak RSA key size (1024 bits)",
		recommendation: "Use RSA key sizes of 2048 bits or larger",
	},
}

// SQL injection patterns
var sqlInjectionPatterns = []struct {
	pattern        *regexp.Regexp
	severity       string
	issueType      string
	description    string
	recommendation string
}{
	{
		pattern:        regexp.MustCompile(`\+.*["'].*\+.*sql`),
		severity:       "critical",
		issueType:      "sql_injection",
		description:    "Potential SQL injection via string concatenation",
		recommendation: "Use parameterized queries or prepared statements",
	},
	{
		pattern:        regexp.MustCompile(`fmt\.Sprintf.*%[sv].*sql`),
		severity:       "high",
		issueType:      "sql_injection_risk",
		description:    "Potential SQL injection via string formatting",
		recommendation: "Use parameterized queries or prepared statements",
	},
}

// Path traversal patterns
var pathTraversalPatterns = []struct {
	pattern        *regexp.Regexp
	severity       string
	issueType      string
	description    string
	recommendation string
}{
	{
		pattern:        regexp.MustCompile(`os\.Open.*\+|\.\./|\.\.\\`),
		severity:       "high",
		issueType:      "path_traversal",
		description:    "Potential path traversal vulnerability",
		recommendation: "Validate and sanitize file paths",
	},
	{
		pattern:        regexp.MustCompile(`filepath\.Join.*\+.*user.*input`),
		severity:       "medium",
		issueType:      "path_traversal_risk",
		description:    "Potential path traversal via user input",
		recommendation: "Validate and sanitize user input for file paths",
	},
}

// XSS patterns
var xssPatterns = []struct {
	pattern        *regexp.Regexp
	severity       string
	issueType      string
	description    string
	recommendation string
}{
	{
		pattern:        regexp.MustCompile(`html/template\.Execute.*\.Raw`),
		severity:       "high",
		issueType:      "xss_vulnerability",
		description:    "Potential XSS vulnerability via raw template execution",
		recommendation: "Use proper template escaping and validation",
	},
	{
		pattern:        regexp.MustCompile(`fmt\.Fprint.*http\.ResponseWriter.*\+`),
		severity:       "medium",
		issueType:      "xss_risk",
		description:    "Potential XSS risk via unescaped output",
		recommendation: "Use proper HTML escaping and validation",
	},
}

// Insecure deserialization patterns
var deserializationPatterns = []struct {
	pattern        *regexp.Regexp
	severity       string
	issueType      string
	description    string
	recommendation string
}{
	{
		pattern:        regexp.MustCompile(`gob\.Decode|json\.Unmarshal|xml\.Unmarshal.*interface{}`),
		severity:       "high",
		issueType:      "insecure_deserialization",
		description:    "Insecure deserialization of untrusted data",
		recommendation: "Validate input before deserialization and use safe formats",
	},
	{
		pattern:        regexp.MustCompile(`yaml\.Unmarshal|toml\.Unmarshal.*interface{}`),
		severity:       "medium",
		issueType:      "insecure_deserialization_risk",
		description:    "Potential insecure deserialization",
		recommendation: "Validate input before deserialization",
	},
}

// CheckFileForSecurityIssues scans a single file for security issues
func CheckFileForSecurityIssues(filePath string) ([]SecurityIssue, error) {
	var issues []SecurityIssue

	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	lines := strings.Split(string(content), "\n")

	// Check for general security patterns
	for lineNum, line := range lines {
		for _, pattern := range securityPatterns {
			if pattern.pattern.MatchString(line) {
				issues = append(issues, SecurityIssue{
					Type:           pattern.issueType,
					Severity:       pattern.severity,
					File:           filePath,
					Line:           lineNum + 1,
					Code:           strings.TrimSpace(line),
					Description:    pattern.description,
					Recommendation: pattern.recommendation,
				})
			}
		}
	}

	// Check for SQL injection patterns
	for lineNum, line := range lines {
		for _, pattern := range sqlInjectionPatterns {
			if pattern.pattern.MatchString(line) {
				issues = append(issues, SecurityIssue{
					Type:           pattern.issueType,
					Severity:       pattern.severity,
					File:           filePath,
					Line:           lineNum + 1,
					Code:           strings.TrimSpace(line),
					Description:    pattern.description,
					Recommendation: pattern.recommendation,
				})
			}
		}
	}

	// Check for path traversal patterns
	for lineNum, line := range lines {
		for _, pattern := range pathTraversalPatterns {
			if pattern.pattern.MatchString(line) {
				issues = append(issues, SecurityIssue{
					Type:           pattern.issueType,
					Severity:       pattern.severity,
					File:           filePath,
					Line:           lineNum + 1,
					Code:           strings.TrimSpace(line),
					Description:    pattern.description,
					Recommendation: pattern.recommendation,
				})
			}
		}
	}

	// Check for XSS patterns
	for lineNum, line := range lines {
		for _, pattern := range xssPatterns {
			if pattern.pattern.MatchString(line) {
				issues = append(issues, SecurityIssue{
					Type:           pattern.issueType,
					Severity:       pattern.severity,
					File:           filePath,
					Line:           lineNum + 1,
					Code:           strings.TrimSpace(line),
					Description:    pattern.description,
					Recommendation: pattern.recommendation,
				})
			}
		}
	}

	// Check for deserialization patterns
	for lineNum, line := range lines {
		for _, pattern := range deserializationPatterns {
			if pattern.pattern.MatchString(line) {
				issues = append(issues, SecurityIssue{
					Type:           pattern.issueType,
					Severity:       pattern.severity,
					File:           filePath,
					Line:           lineNum + 1,
					Code:           strings.TrimSpace(line),
					Description:    pattern.description,
					Recommendation: pattern.recommendation,
				})
			}
		}
	}

	return issues, nil
}

// CheckGoAST performs AST-based security analysis
func CheckGoAST(filePath string) ([]SecurityIssue, error) {
	var issues []SecurityIssue

	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Go file %s: %w", filePath, err)
	}

	// Walk the AST to find security issues
	ast.Inspect(node, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.CallExpr:
			// Check for insecure function calls
			if sel, ok := x.Fun.(*ast.SelectorExpr); ok {
				if ident, ok := sel.X.(*ast.Ident); ok {
					// Check for exec.Command calls
					if ident.Name == "exec" && sel.Sel.Name == "Command" {
						issues = append(issues, SecurityIssue{
							Type:           "command_execution",
							Severity:       "medium",
							File:           filePath,
							Line:           fset.Position(x.Pos()).Line,
							Code:           "exec.Command",
							Description:    "Use of exec.Command function",
							Recommendation: "Validate and sanitize all input to command execution",
						})
					}

					// Check for sql.Query calls
					if ident.Name == "db" && sel.Sel.Name == "Query" {
						issues = append(issues, SecurityIssue{
							Type:           "sql_query",
							Severity:       "medium",
							File:           filePath,
							Line:           fset.Position(x.Pos()).Line,
							Code:           "db.Query",
							Description:    "Direct SQL query execution",
							Recommendation: "Use parameterized queries or prepared statements",
						})
					}
				}
			}
		}
		return true
	})

	return issues, nil
}

// ScanDirectory scans a directory for security issues
func ScanDirectory(rootDir string) (*SecurityReport, error) {
	report := &SecurityReport{
		Issues:   []SecurityIssue{},
		Package:  "github.com/SDLC/sdln-sdk-go",
		ScanTime: "2025-11-03T18:00:00Z",
	}

	err := filepath.WalkDir(rootDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Skip certain directories
		if d.IsDir() {
			switch d.Name() {
			case "vendor", "node_modules", ".git", "docs", "examples":
				return filepath.SkipDir
			}
		}

		// Only scan Go files
		if strings.HasSuffix(path, ".go") {
			// Skip test files for now to focus on main code
			if strings.HasSuffix(path, "_test.go") {
				return nil
			}

			// Pattern-based analysis
			issues, err := CheckFileForSecurityIssues(path)
			if err != nil {
				log.Printf("Error scanning file %s: %v", path, err)
				return nil
			}
			report.Issues = append(report.Issues, issues...)

			// AST-based analysis
			astIssues, err := CheckGoAST(path)
			if err != nil {
				log.Printf("Error analyzing AST for file %s: %v", path, err)
				return nil
			}
			report.Issues = append(report.Issues, astIssues...)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to scan directory: %w", err)
	}

	// Count issues by severity
	for _, issue := range report.Issues {
		report.TotalIssues++
		switch issue.Severity {
		case "critical":
			report.CriticalIssues++
		case "high":
			report.HighIssues++
		case "medium":
			report.MediumIssues++
		case "low":
			report.LowIssues++
		}
	}

	return report, nil
}

// GenerateSecurityReport generates a comprehensive security report
func GenerateSecurityReport(report *SecurityReport) error {
	reportJSON, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal security report: %w", err)
	}

	// Write JSON report
	err = os.WriteFile("security_report.json", reportJSON, 0644)
	if err != nil {
		return fmt.Errorf("failed to write security report: %w", err)
	}

	// Generate markdown report
	var markdown strings.Builder
	markdown.WriteString("# Security Analysis Report\n\n")
	markdown.WriteString(fmt.Sprintf("**Generated:** %s\n", report.ScanTime))
	markdown.WriteString(fmt.Sprintf("**Package:** %s\n\n", report.Package))

	markdown.WriteString("## Executive Summary\n\n")
	markdown.WriteString(fmt.Sprintf("- **Total Issues:** %d\n", report.TotalIssues))
	markdown.WriteString(fmt.Sprintf("- **Critical Issues:** %d\n", report.CriticalIssues))
	markdown.WriteString(fmt.Sprintf("- **High Issues:** %d\n", report.HighIssues))
	markdown.WriteString(fmt.Sprintf("- **Medium Issues:** %d\n", report.MediumIssues))
	markdown.WriteString(fmt.Sprintf("- **Low Issues:** %d\n\n", report.LowIssues))

	// Security score
	score := calculateSecurityScore(report)
	markdown.WriteString(fmt.Sprintf("**Security Score:** %d/100\n\n", score))

	// Detailed findings
	if len(report.Issues) > 0 {
		markdown.WriteString("## Detailed Findings\n\n")

		// Group by severity
		bySeverity := make(map[string][]SecurityIssue)
		for _, issue := range report.Issues {
			bySeverity[issue.Severity] = append(bySeverity[issue.Severity], issue)
		}

		for _, severity := range []string{"critical", "high", "medium", "low"} {
			if issues, exists := bySeverity[severity]; exists && len(issues) > 0 {
				markdown.WriteString(fmt.Sprintf("### %s Issues (%d)\n\n",
					strings.Title(severity), len(issues)))

				for _, issue := range issues {
					markdown.WriteString(fmt.Sprintf("#### %s\n\n", issue.Type))
					markdown.WriteString(fmt.Sprintf("**File:** `%s:%d`\n\n", issue.File, issue.Line))
					markdown.WriteString(fmt.Sprintf("**Code:** `%s`\n\n", issue.Code))
					markdown.WriteString(fmt.Sprintf("**Description:** %s\n\n", issue.Description))
					markdown.WriteString(fmt.Sprintf("**Recommendation:** %s\n\n", issue.Recommendation))
					markdown.WriteString("---\n\n")
				}
			}
		}
	} else {
		markdown.WriteString("## ✅ No Security Issues Found\n\n")
		markdown.WriteString("Great job! No security vulnerabilities were detected in the codebase.\n\n")
	}

	// Recommendations
	markdown.WriteString("## Security Recommendations\n\n")
	if report.CriticalIssues > 0 {
		markdown.WriteString("- **URGENT:** Address all critical security issues immediately\n")
	}
	if report.HighIssues > 0 {
		markdown.WriteString("- **HIGH PRIORITY:** Address high-severity issues in the next release\n")
	}
	if report.MediumIssues > 0 {
		markdown.WriteString("- **MEDIUM PRIORITY:** Address medium-severity issues in upcoming releases\n")
	}
	if report.LowIssues > 0 {
		markdown.WriteString("- **LOW PRIORITY:** Address low-severity issues when time permits\n")
	}
	markdown.WriteString("- Implement automated security scanning in CI/CD pipeline\n")
	markdown.WriteString("- Regular security audits and penetration testing\n")
	markdown.WriteString("- Keep dependencies updated and monitor for security advisories\n\n")

	// Write markdown report
	err = os.WriteFile("security_report.md", []byte(markdown.String()), 0644)
	if err != nil {
		return fmt.Errorf("failed to write markdown report: %w", err)
	}

	return nil
}

// calculateSecurityScore calculates a security score (0-100)
func calculateSecurityScore(report *SecurityReport) int {
	if report.TotalIssues == 0 {
		return 100
	}

	// Weight issues by severity
	score := 100
	score -= report.CriticalIssues * 25
	score -= report.HighIssues * 15
	score -= report.MediumIssues * 8
	score -= report.LowIssues * 3

	if score < 0 {
		score = 0
	}

	return score
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run security_analysis.go <directory>")
		os.Exit(1)
	}

	rootDir := os.Args[1]

	fmt.Printf("🔍 Starting security analysis of: %s\n", rootDir)

	report, err := ScanDirectory(rootDir)
	if err != nil {
		log.Fatalf("❌ Security analysis failed: %v", err)
	}

	err = GenerateSecurityReport(report)
	if err != nil {
		log.Fatalf("❌ Failed to generate security report: %v", err)
	}

	fmt.Printf("✅ Security analysis complete!\n")
	fmt.Printf("📊 Total Issues: %d\n", report.TotalIssues)
	fmt.Printf("🚨 Critical: %d\n", report.CriticalIssues)
	fmt.Printf("⚠️  High: %d\n", report.HighIssues)
	fmt.Printf("⚡ Medium: %d\n", report.MediumIssues)
	fmt.Printf("ℹ️  Low: %d\n", report.LowIssues)

	score := calculateSecurityScore(report)
	fmt.Printf("🛡️  Security Score: %d/100\n", score)

	fmt.Println("\n📄 Reports generated:")
	fmt.Println("  - security_report.json (detailed JSON)")
	fmt.Println("  - security_report.md (readable markdown)")
}
