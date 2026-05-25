package domain

import "testing"

func TestParseSubscriptionStatus(t *testing.T) {
	tests := []struct {
		input    string
		expected SubscriptionStatus
		wantErr  bool
	}{
		{"trialing", StatusTrialing, false},
		{"Trialing", StatusTrialing, false},
		{"active", StatusActive, false},
		{"Active", StatusActive, false},
		{"past_due", StatusPastDue, false},
		{"paused", StatusPaused, false},
		{"cancelled", StatusCancelled, false},
		{"expired", StatusExpired, false},
		{"invalid", "", true},
		{"unknown", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got, err := ParseSubscriptionStatus(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseSubscriptionStatus() error = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.expected {
				t.Errorf("ParseSubscriptionStatus() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestSubscriptionStatusIsActive(t *testing.T) {
	tests := []struct {
		status   SubscriptionStatus
		expected bool
	}{
		{StatusTrialing, true},
		{StatusActive, true},
		{StatusPastDue, false},
		{StatusPaused, false},
		{StatusCancelled, false},
		{StatusExpired, false},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			if got := tt.status.IsActive(); got != tt.expected {
				t.Errorf("IsActive() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestSubscriptionStatusDisplayName(t *testing.T) {
	tests := []struct {
		status   SubscriptionStatus
		expected string
	}{
		{StatusTrialing, "Trialing"},
		{StatusActive, "Active"},
		{StatusPastDue, "Past Due"},
		{StatusPaused, "Paused"},
		{StatusCancelled, "Cancelled"},
		{StatusExpired, "Expired"},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			if got := tt.status.DisplayName(); got != tt.expected {
				t.Errorf("DisplayName() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestSubscriptionStatusIsValid(t *testing.T) {
	tests := []struct {
		status   SubscriptionStatus
		expected bool
	}{
		{StatusTrialing, true},
		{StatusActive, true},
		{StatusPastDue, true},
		{StatusPaused, true},
		{StatusCancelled, true},
		{StatusExpired, true},
		{SubscriptionStatus("invalid"), false},
	}
	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			if got := tt.status.IsValid(); got != tt.expected {
				t.Errorf("IsValid() = %v, want %v", got, tt.expected)
			}
		})
	}
}
