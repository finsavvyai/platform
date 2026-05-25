package domain

import "testing"

func TestNewDomainAllowlist(t *testing.T) {
	tests := []struct {
		name     string
		tenantID string
		maxDoms  int
		wantErr  bool
	}{
		{"valid", "t1", 5, false},
		{"empty tenant", "", 5, true},
		{"zero max", "t1", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewDomainAllowlist(tt.tenantID, tt.maxDoms)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewDomainAllowlist() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAddDomain(t *testing.T) {
	da, _ := NewDomainAllowlist("t1", 2)
	if err := da.AddDomain("example.com"); err != nil {
		t.Errorf("AddDomain() error = %v", err)
	}
	if len(da.AllowedDomains) != 1 {
		t.Errorf("AllowedDomains len = %d, want 1", len(da.AllowedDomains))
	}
	if err := da.AddDomain("example.com"); err == nil {
		t.Error("AddDomain() should fail on duplicate")
	}
	if err := da.AddDomain("another.com"); err != nil {
		t.Errorf("AddDomain() error = %v", err)
	}
	if err := da.AddDomain("third.com"); err == nil {
		t.Error("AddDomain() should fail when max reached")
	}
}

func TestIsAllowed(t *testing.T) {
	da, _ := NewDomainAllowlist("t1", 5)
	da.AddDomain("example.com")
	da.AddDomain("test.io")

	tests := []struct {
		origin string
		want   bool
	}{
		{"example.com", true},
		{"sub.example.com", true},
		{"test.io", true},
		{"other.com", false},
	}
	for _, tt := range tests {
		if got := da.IsAllowed(tt.origin); got != tt.want {
			t.Errorf("IsAllowed(%s) = %v, want %v", tt.origin, got, tt.want)
		}
	}
}

func TestRemoveDomain(t *testing.T) {
	da, _ := NewDomainAllowlist("t1", 5)
	da.AddDomain("example.com")
	da.RemoveDomain("example.com")
	if len(da.AllowedDomains) != 0 {
		t.Error("RemoveDomain() should remove domain")
	}
}
