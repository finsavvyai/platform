package ingestion

import "testing"

func TestUnDOBToISO(t *testing.T) {
	tests := []struct {
		name       string
		y, m, d    string
		want       string
	}{
		{"full iso", "1972", "6", "15", "1972-06-15"},
		{"full iso padded", "1972", "06", "15", "1972-06-15"},
		{"year + month only", "1972", "6", "", "1972-06"},
		{"year only", "1972", "", "", "1972"},
		{"empty year", "", "6", "15", ""},
		{"invalid month", "1972", "13", "15", "1972"},
		{"invalid day", "1972", "6", "32", "1972-06"},
		{"junk month", "1972", "xx", "", "1972"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := unDOBToISO(tc.y, tc.m, tc.d)
			if got != tc.want {
				t.Errorf("got %q want %q", got, tc.want)
			}
		})
	}
}

func TestFormatDOBsISO(t *testing.T) {
	dobs := []unDOB{
		{Year: "1972", Month: "6", Day: "15"},
		{Date: "1985-03-01"},
	}
	got := formatDOBs(dobs)
	want := "1972-06-15; 1985-03-01"
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}
