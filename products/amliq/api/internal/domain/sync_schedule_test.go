package domain

import "testing"

func TestValidateSyncSchedule(t *testing.T) {
	tests := []struct {
		name    string
		expr    string
		wantErr bool
	}{
		{"every 3h (8/day)", "0 */3 * * *", false},
		{"every 1h (24/day)", "0 */1 * * *", false},
		{"every 15min (96/day)", "*/15 * * * *", false},
		{"every 4h (6/day)", "0 */4 * * *", true},
		{"every 24h (1/day)", "0 */24 * * *", true},
		{"once daily at 3am", "0 3 * * *", true},
		{"empty", "", true},
		{"three fields", "0 3 *", true},
		{"garbage hour step", "0 */abc * * *", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSyncSchedule(tt.expr)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateSyncSchedule(%q) err=%v wantErr=%v",
					tt.expr, err, tt.wantErr)
			}
		})
	}
}

func TestNormalizeSyncSchedule(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"valid passes through", "0 */3 * * *", "0 */3 * * *"},
		{"invalid → default", "0 3 * * *", DefaultSyncSchedule},
		{"empty → default", "", DefaultSyncSchedule},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeSyncSchedule(tt.in)
			if got != tt.want {
				t.Errorf("NormalizeSyncSchedule(%q) = %q, want %q",
					tt.in, got, tt.want)
			}
		})
	}
}
