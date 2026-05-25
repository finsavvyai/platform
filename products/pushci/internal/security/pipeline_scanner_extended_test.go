package security

import (
	"os"
	"testing"
)

// TestScanPipelineConfig_GitHubActions tests scanning a GitHub Actions workflow
func TestScanPipelineConfig_GitHubActions(t *testing.T) {
	config := `name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test
      - run: npm run build
env:
  API_KEY: ghp_1234567890123456789012345678
`
	tmpfile, _ := os.CreateTemp("", "github*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	if result.RiskScore == 0 {
		t.Error("Expected non-zero risk score for GitHub Actions config with secret")
	}

	criticalCount := countSeverity(result.Findings, "critical")
	if criticalCount == 0 {
		t.Error("Expected critical severity finding for hardcoded secret")
	}
}

// TestScanPipelineConfig_GitLabCI tests scanning a GitLab CI configuration
func TestScanPipelineConfig_GitLabCI(t *testing.T) {
	config := `stages:
  - test
  - deploy

test:
  stage: test
  script:
    - npm install
    - npm test

deploy:
  stage: deploy
  script:
    - npm run build
  only:
    - main
`
	tmpfile, _ := os.CreateTemp("", "gitlab*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	if len(result.Findings) > 0 {
		for _, f := range result.Findings {
			if f.Category == "supply-chain" && f.Severity == "low" {
				return // Expected unpinned npm dependency
			}
		}
	}
}

// TestScanPipelineConfig_Bitbucket tests scanning a Bitbucket Pipelines config
func TestScanPipelineConfig_Bitbucket(t *testing.T) {
	config := `image: node:18
pipelines:
  default:
    - step:
        name: Build and Test
        script:
          - npm install
          - npm test
          - npm run build
`
	tmpfile, _ := os.CreateTemp("", "bitbucket*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	if result.Summary == "" {
		t.Error("Expected non-empty summary")
	}
}

// TestScanPipelineConfig_Jenkins tests scanning a Jenkinsfile-style config
func TestScanPipelineConfig_Jenkins(t *testing.T) {
	config := `pipeline {
    agent any
    stages {
        stage('Test') {
            steps {
                sh 'npm test'
                sh 'npm run lint'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }
}
`
	tmpfile, _ := os.CreateTemp("", "jenkins*.txt")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	hasTest := false
	for _, f := range result.Findings {
		if f.Title == "Missing Test Step" {
			hasTest = true
		}
	}
	if hasTest {
		t.Error("Should not report missing test when test step exists")
	}
}

// TestScanPipelineConfig_CleanConfig tests scanning a clean, secure config
func TestScanPipelineConfig_CleanConfig(t *testing.T) {
	config := `name: Secure CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run sast
`
	tmpfile, _ := os.CreateTemp("", "clean*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	if result.RiskScore > 20 {
		t.Errorf("Expected low risk score for clean config, got %d", result.RiskScore)
	}

	criticalCount := countSeverity(result.Findings, "critical")
	if criticalCount > 0 {
		t.Errorf("Expected no critical findings in clean config, got %d", criticalCount)
	}
}

// TestScanPipelineConfig_AllViolations tests config with every possible issue
func TestScanPipelineConfig_AllViolations(t *testing.T) {
	config := `name: Bad CI
env:
  API_KEY: ghp_1234567890
  SECRET_TOKEN: sk_test_123456789012345678
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      write-all: true
    steps:
      - uses: actions/checkout@v3
      - run: pip install requests
      - run: npm install lodash
      - run: npm run deploy
`
	tmpfile, _ := os.CreateTemp("", "violations*.yml")
	defer os.Remove(tmpfile.Name())
	tmpfile.WriteString(config)
	tmpfile.Close()

	result, err := ScanPipelineConfig(tmpfile.Name())
	if err != nil {
		t.Fatalf("ScanPipelineConfig failed: %v", err)
	}

	if len(result.Findings) < 4 {
		t.Errorf("Expected at least 4 findings, got %d", len(result.Findings))
	}

	if result.RiskScore <= 50 {
		t.Errorf("Expected high risk score for config with multiple violations, got %d", result.RiskScore)
	}

	categories := make(map[string]int)
	for _, f := range result.Findings {
		categories[f.Category]++
	}

	if categories["secrets"] == 0 {
		t.Error("Expected findings in secrets category")
	}
	if categories["permissions"] == 0 {
		t.Error("Expected findings in permissions category")
	}
}

// TestCheckHardcodedSecrets_AWSKeys tests detection of AWS access keys
func TestCheckHardcodedSecrets_AWSKeys(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		hasSecret bool
	}{
		{
			"AWS access key",
			`aws_access_key_id: AKIAIOSFODNN7EXAMPLE`,
			true,
		},
		{
			"AWS secret key",
			`aws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`,
			true,
		},
		{
			"GitHub token ghp",
			`token: ghp_1234567890123456789012345678901234`,
			true,
		},
		{
			"No secrets",
			`password: ${{ secrets.PASSWORD }}`,
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpfile, _ := os.CreateTemp("", "secret*.txt")
			defer os.Remove(tmpfile.Name())
			tmpfile.WriteString(tt.content)
			tmpfile.Close()

			result, err := ScanPipelineConfig(tmpfile.Name())
			if err != nil {
				t.Fatalf("scan failed: %v", err)
			}

			hasSecret := false
			for _, f := range result.Findings {
				if f.Severity == "critical" && f.Category == "secrets" {
					hasSecret = true
					break
				}
			}

			if hasSecret != tt.hasSecret {
				t.Errorf("hasSecret: got %v, want %v", hasSecret, tt.hasSecret)
			}
		})
	}
}

// TestCheckHardcodedSecrets_Tokens tests detection of various token types
func TestCheckHardcodedSecrets_Tokens(t *testing.T) {
	tokens := []struct {
		name    string
		content string
	}{
		{"GitLab token", "GITLAB_TOKEN=glpat-abc123xyz789"},
		{"Slack webhook", "SLACK_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"},
		{"Stripe key", "stripe_secret_key: sk_test_4eC39HqLyjWDarhtT657tJ1V"},
	}

	for _, tt := range tokens {
		t.Run(tt.name, func(t *testing.T) {
			tmpfile, _ := os.CreateTemp("", "token*.txt")
			defer os.Remove(tmpfile.Name())
			tmpfile.WriteString(tt.content)
			tmpfile.Close()

			result, _ := ScanPipelineConfig(tmpfile.Name())
			if len(result.Findings) == 0 {
				t.Errorf("Expected to find secret for %s", tt.name)
			}
		})
	}
}

// TestCheckMissingSecuritySteps tests detection of missing security checks
func TestCheckMissingSecuritySteps(t *testing.T) {
	tests := []struct {
		name          string
		content       string
		expectMissing string
	}{
		{
			"Missing tests",
			`steps:
  - lint: npm run lint
  - sast: semgrep`,
			"Missing Test Step",
		},
		{
			"Missing lint",
			`steps:
  - test: npm test
  - sast: semgrep`,
			"Missing Lint Step",
		},
		{
			"Missing SAST",
			`steps:
  - test: npm test
  - lint: npm run lint`,
			"No SAST Scanning",
		},
		{
			"All present",
			`steps:
  - test: npm test
  - lint: npm run lint
  - sast: semgrep`,
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpfile, _ := os.CreateTemp("", "check*.yml")
			defer os.Remove(tmpfile.Name())
			tmpfile.WriteString(tt.content)
			tmpfile.Close()

			result, _ := ScanPipelineConfig(tmpfile.Name())

			found := false
			for _, f := range result.Findings {
				if f.Title == tt.expectMissing {
					found = true
					break
				}
			}

			if (tt.expectMissing != "") && !found {
				t.Errorf("Expected to find: %s", tt.expectMissing)
			}
			if (tt.expectMissing == "") && len(result.Findings) > 0 {
				t.Errorf("Expected no findings, got %d", len(result.Findings))
			}
		})
	}
}
