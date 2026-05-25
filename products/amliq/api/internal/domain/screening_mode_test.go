package domain

import (
	"testing"
)

func TestScreeningModeString(t *testing.T) {
	tests := []struct {
		name string
		mode ScreeningMode
		want string
	}{
		{name: "realtime", mode: ScreeningModeRealtime, want: "Realtime"},
		{name: "batch", mode: ScreeningModeBatch, want: "Batch"},
		{name: "both", mode: ScreeningModeBoth, want: "Both"},
		{name: "unknown", mode: ScreeningMode(99), want: "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.mode.String()
			if got != tt.want {
				t.Errorf("String() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestParseScreeningMode(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    ScreeningMode
		wantErr bool
	}{
		{name: "realtime lowercase", input: "realtime", want: ScreeningModeRealtime},
		{name: "Realtime capitalized", input: "Realtime", want: ScreeningModeRealtime},
		{name: "batch lowercase", input: "batch", want: ScreeningModeBatch},
		{name: "Batch capitalized", input: "Batch", want: ScreeningModeBatch},
		{name: "both lowercase", input: "both", want: ScreeningModeBoth},
		{name: "Both capitalized", input: "Both", want: ScreeningModeBoth},
		{name: "invalid input", input: "invalid", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseScreeningMode(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("ParseScreeningMode() = %v, want %v", got, tt.want)
			}
		})
	}
}
