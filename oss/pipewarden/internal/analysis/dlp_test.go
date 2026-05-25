package analysis

import (
	"testing"
)

func TestDLPScanner_AWSAccessKey(t *testing.T) {
	scanner := NewDLPScanner()
	content := "env:\n  AWS_KEY: AKIA1234567890ABCDEF"

	findings := scanner.ScanContent(content, "test.yml")
	if len(findings) == 0 {
		t.Error("expected to detect AWS access key")
	}
	if findings[0].Pattern != "AWS Access Key" {
		t.Errorf("expected pattern 'AWS Access Key', got %s", findings[0].Pattern)
	}
	if findings[0].Severity != SeverityCritical {
		t.Errorf("expected critical severity, got %s", findings[0].Severity)
	}
}

func TestDLPScanner_GitHubToken(t *testing.T) {
	tests := []struct {
		name    string
		content string
		pattern string
	}{
		{
			name:    "ghp token",
			content: "GH_TOKEN=ghp_1234567890123456789012345678901234567",
			pattern: "GitHub Personal Access Token",
		},
		{
			name:    "gho token",
			content: "oauth: gho_9876543210987654321098765432109876543",
			pattern: "GitHub OAuth Token",
		},
		{
			name:    "ghs token",
			content: "app_token: ghs_abcdefghijklmnopqrstuvwxyz1234567890",
			pattern: "GitHub App Token",
		},
	}

	scanner := NewDLPScanner()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := scanner.ScanContent(tt.content, "config.yml")
			if len(findings) == 0 {
				t.Errorf("expected to detect GitHub token")
			}
			if findings[0].Pattern != tt.pattern {
				t.Errorf("expected pattern %s, got %s", tt.pattern, findings[0].Pattern)
			}
			if findings[0].Severity != SeverityCritical {
				t.Errorf("expected critical severity, got %s", findings[0].Severity)
			}
		})
	}
}

func TestDLPScanner_GitLabToken(t *testing.T) {
	scanner := NewDLPScanner()
	content := "GITLAB_TOKEN: glpat-abcdefghijklmnopqrst"

	findings := scanner.ScanContent(content, "secrets.yml")
	if len(findings) == 0 {
		t.Error("expected to detect GitLab token")
	}
	if findings[0].Pattern != "GitLab Personal Access Token" {
		t.Errorf("expected 'GitLab Personal Access Token', got %s", findings[0].Pattern)
	}
}

func TestDLPScanner_SlackTokens(t *testing.T) {
	tests := []struct {
		name    string
		content string
		pattern string
	}{
		{
			name:    "bot token",
			content: "slack_bot_token: xoxb-1234567890-1234567890-aBcDeFgHiJkLmNoPqRsTuVwX",
			pattern: "Slack Bot Token",
		},
		{
			name:    "user token",
			content: "slack_user: xoxp-1234567890-1234567890-1234567890-aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
			pattern: "Slack User Token",
		},
	}

	scanner := NewDLPScanner()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := scanner.ScanContent(tt.content, "config.yml")
			if len(findings) == 0 {
				t.Errorf("expected to detect Slack token")
			}
			if findings[0].Pattern != tt.pattern {
				t.Errorf("expected %s, got %s", tt.pattern, findings[0].Pattern)
			}
		})
	}
}

func TestDLPScanner_SSHPrivateKey(t *testing.T) {
	content := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2Z3qX2BTLS4e...
-----END RSA PRIVATE KEY-----`

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "id_rsa")

	if len(findings) == 0 {
		t.Error("expected to detect SSH private key")
	}
	if findings[0].Severity != SeverityCritical {
		t.Errorf("expected critical severity, got %s", findings[0].Severity)
	}
}

func TestDLPScanner_DatabaseURL(t *testing.T) {
	tests := []struct {
		name    string
		content string
	}{
		{
			name:    "postgres",
			content: "DATABASE_URL: postgres://user:password@localhost:5432/db",
		},
		{
			name:    "mysql",
			content: "db_connection: mysql://admin:secret123@db.example.com:3306/prod",
		},
		{
			name:    "mongodb",
			content: "mongo_uri: mongodb://root:myPassword123@mongo.example.com:27017/",
		},
	}

	scanner := NewDLPScanner()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			findings := scanner.ScanContent(tt.content, "env.yml")
			if len(findings) == 0 {
				t.Errorf("expected to detect database URL credentials")
			}
			if findings[0].Severity != SeverityCritical {
				t.Errorf("expected critical severity, got %s", findings[0].Severity)
			}
		})
	}
}

func TestDLPScanner_APIKey(t *testing.T) {
	content := "api_key = sk_live_abcdef1234567890abcdef1234567890"

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "config.py")

	if len(findings) == 0 {
		t.Error("expected to detect API key")
	}
	if findings[0].Pattern != "Generic API Key" {
		t.Errorf("expected 'Generic API Key', got %s", findings[0].Pattern)
	}
}

func TestDLPScanner_JWTToken(t *testing.T) {
	content := "auth_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "auth.yml")

	if len(findings) == 0 {
		t.Error("expected to detect JWT token")
	}
	if findings[0].Pattern != "JWT Token" {
		t.Errorf("expected 'JWT Token', got %s", findings[0].Pattern)
	}
}

func TestDLPScanner_BasicAuthURL(t *testing.T) {
	content := "webhook_url: https://admin:securePassword123@api.example.com/webhook"

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "deploy.yml")

	if len(findings) == 0 {
		t.Error("expected to detect basic auth credentials in URL")
	}
	if findings[0].Severity != SeverityHigh {
		t.Errorf("expected high severity, got %s", findings[0].Severity)
	}
}

func TestDLPScanner_MultipleFindings(t *testing.T) {
	content := `env:
  AWS_KEY: AKIA1234567890ABCDEF
  GH_TOKEN: ghp_1234567890123456789012345678901234567
  DB_URL: postgres://user:password@localhost:5432/db`

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "config.yml")

	if len(findings) < 3 {
		t.Errorf("expected at least 3 findings, got %d", len(findings))
	}
}

func TestDLPScanner_LineNumbers(t *testing.T) {
	content := `line 1
line 2
GH_TOKEN: ghp_1234567890123456789012345678901234567
line 4`

	scanner := NewDLPScanner()
	findings := scanner.ScanContent(content, "test.yml")

	if len(findings) == 0 {
		t.Error("expected to find GitHub token")
	}
	if findings[0].Line != 3 {
		t.Errorf("expected line 3, got line %d", findings[0].Line)
	}
}

func TestRedactSecret(t *testing.T) {
	tests := []struct {
		secret   string
		visible  int
		expected string
	}{
		{"AKIA1234567890123456", 4, "AKIA****"},
		{"abc", 5, "****"},
		{"ghp_1234567890", 3, "ghp****"},
	}

	for _, tt := range tests {
		result := redactSecret(tt.secret, tt.visible)
		if result != tt.expected {
			t.Errorf("redactSecret(%s, %d) = %s, expected %s", tt.secret, tt.visible, result, tt.expected)
		}
	}
}
