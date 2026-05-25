package heal

import "testing"

func TestD1TableExists(t *testing.T) {
	tests := []struct {
		output string
		want   bool
		table  string
	}{
		{`table "users" already exists`, true, "users"},
		{`table 'organizations' already exists`, true, "organizations"},
		{"all migrations applied", false, ""},
	}
	for _, tt := range tests {
		fix := d1TableExists(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("d1TableExists(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
		if fix != nil && fix.Pattern != "d1-table-exists" {
			t.Errorf("pattern = %q, want d1-table-exists", fix.Pattern)
		}
	}
}

func TestD1ColumnMissing(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"no such column: users.email", true},
		{"no such column: tenants.status", true},
		{"query executed successfully", false},
	}
	for _, tt := range tests {
		fix := d1ColumnMissing(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("d1ColumnMissing(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
		if fix != nil && fix.Pattern != "d1-column-missing" {
			t.Errorf("pattern = %q, want d1-column-missing", fix.Pattern)
		}
	}
}

func TestD1ForeignKey(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"FOREIGN KEY constraint failed", true},
		{"insert completed", false},
	}
	for _, tt := range tests {
		fix := d1ForeignKey(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("d1ForeignKey(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
	}
}

func TestD1SQLiteGeneric(t *testing.T) {
	tests := []struct {
		output string
		want   bool
	}{
		{"SQLITE_ERROR: near syntax error", true},
		{"D1_ERROR: something went wrong", true},
		{"all good", false},
	}
	for _, tt := range tests {
		fix := d1SQLiteGeneric(tt.output)
		if (fix != nil) != tt.want {
			t.Errorf("d1SQLiteGeneric(%q) = %v, want %v", tt.output, fix != nil, tt.want)
		}
	}
}

func TestD1StrategiesCount(t *testing.T) {
	if len(d1Strategies()) != 4 {
		t.Fatalf("expected 4 D1 strategies, got %d", len(d1Strategies()))
	}
}
