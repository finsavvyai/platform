package ingestion

import (
	"testing"
)

func TestNBCTFParser(t *testing.T) {
	tests := []struct {
		name       string
		data       string
		wantCount  int
		wantErr    bool
		checkIDLen int
	}{
		{
			name:    "empty_data",
			data:    "",
			wantErr: true,
		},
		{
			name: "html_table_rows",
			data: `<table>
				<tr><td>חמאס</td><td>Hamas</td></tr>
				<tr><td>חיזבאללה</td><td>Hezbollah</td></tr>
			</table>`,
			wantCount: 2,
		},
		{
			name: "single_hebrew_only",
			data: `<table>
				<tr><td>ג&#39;יהאד אסלאמי</td><td></td></tr>
			</table>`,
			wantCount: 1,
		},
		{
			name: "csv_fallback",
			data: "num,c1,c2,c3,c4,c5,name_heb,name_eng\n" +
				"000000000001,,,,,,Test Org,Test Org",
			wantCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewNBCTFParser()
			entities, err := p.Parse([]byte(tt.data))
			if (err != nil) != tt.wantErr {
				t.Errorf("Parse() err=%v, wantErr=%v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(entities) != tt.wantCount {
				t.Errorf("Parse() got %d entities, want %d", len(entities), tt.wantCount)
			}
		})
	}
}

func TestCleanHTML(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"  hello  ", "hello"},
		{"a&amp;b", "a&b"},
		{"it&#39;s", "it's"},
		{"a&nbsp;b", "a b"},
	}
	for _, tt := range tests {
		got := cleanHTML(tt.input)
		if got != tt.want {
			t.Errorf("cleanHTML(%q)=%q, want %q", tt.input, got, tt.want)
		}
	}
}
