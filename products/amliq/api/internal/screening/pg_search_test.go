package screening

import (
	"testing"
)

func TestPGSearcherRequiresName(t *testing.T) {
	tests := []struct {
		name    string
		query   string
		wantErr bool
	}{
		{
			name:    "empty name returns error",
			query:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// PGSearcher requires a real DB; test validation only.
			ps := &PGSearcher{db: nil}
			_, err := ps.Search(tt.query, SearchOpts{})
			if (err != nil) != tt.wantErr {
				t.Errorf("Search(%q) err=%v, wantErr=%v", tt.query, err, tt.wantErr)
			}
		})
	}
}

func TestPGSearcherNewCreation(t *testing.T) {
	ps := NewPGSearcher(nil)
	if ps == nil {
		t.Fatal("NewPGSearcher returned nil")
	}
}
