package security

import "testing"

func TestSanitizeName(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"clean name", "John Smith", "John Smith"},
		{"sql injection", "'; DROP TABLE users--", "users"},
		{"html tags", "<b>bold</b>", "bold"},
		{"xss script", "<script>alert(1)</script>", "alert(1)"},
		{"null bytes", "John\x00Smith", "JohnSmith"},
		{"control chars", "John\x01\x02Smith", "JohnSmith"},
		{"unicode name", "José García", "José García"},
		{"empty string", "", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeName(tt.input)
			if got != tt.want {
				t.Errorf("SanitizeName(%q) = %q, want %q",
					tt.input, got, tt.want)
			}
		})
	}
}

func TestSanitizeEmail(t *testing.T) {
	tests := []struct{ name, input, want string; wantErr bool }{
		{"valid", "User@Example.com", "user@example.com", false},
		{"invalid", "not-an-email", "", true},
		{"empty", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := SanitizeEmail(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSanitizeCountryCode(t *testing.T) {
	tests := []struct{ name, input, want string; wantErr bool }{
		{"alpha2", "us", "US", false}, {"alpha3", "usa", "USA", false},
		{"invalid", "1234", "", true}, {"too long", "ABCD", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := SanitizeCountryCode(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}

func TestContainsSQLInjection(t *testing.T) {
	tests := []struct{ input string; want bool }{
		{"SELECT * FROM users", false}, {"'; DROP TABLE--", true},
		{"normal name", false}, {"1; DELETE FROM accounts", true},
	}
	for _, tt := range tests {
		if got := ContainsSQLInjection(tt.input); got != tt.want {
			t.Errorf("ContainsSQLInjection(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestContainsXSS(t *testing.T) {
	tests := []struct{ input string; want bool }{
		{"<script>alert(1)</script>", true}, {"onclick=steal()", true},
		{"normal text", false}, {"javascript:void(0)", true},
	}
	for _, tt := range tests {
		if got := ContainsXSS(tt.input); got != tt.want {
			t.Errorf("ContainsXSS(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
