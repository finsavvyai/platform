package agent

import (
	"bytes"
	"testing"
)

func TestEncryptedScreener(t *testing.T) {
	key := []byte("test-encryption-key-for-amliq")

	tests := []struct {
		name        string
		entityNames []string
		queryNames  []string
		queryKey    []byte
		wantMatched []bool
	}{
		{
			name:        "same name produces same token and matches",
			entityNames: []string{"John Smith"},
			queryNames:  []string{"John Smith"},
			queryKey:    key,
			wantMatched: []bool{true},
		},
		{
			name:        "different names produce different tokens",
			entityNames: []string{"John Smith"},
			queryNames:  []string{"Jane Doe"},
			queryKey:    key,
			wantMatched: []bool{false},
		},
		{
			name:        "matching works on multiple tokens",
			entityNames: []string{"Alice Wonder", "Bob Builder"},
			queryNames:  []string{"Alice Wonder", "Charlie Brown", "Bob Builder"},
			queryKey:    key,
			wantMatched: []bool{true, false, true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			es := NewEncryptedScreener()
			err := es.LoadTokenizedEntities(tt.entityNames, key)
			if err != nil {
				t.Fatalf("load entities: %v", err)
			}

			tokens := GenerateTokens(tt.queryNames, tt.queryKey)
			results, err := es.ScreenTokens(tokens)
			if err != nil {
				t.Fatalf("screen tokens: %v", err)
			}

			if len(results) != len(tt.wantMatched) {
				t.Fatalf("got %d results, want %d", len(results), len(tt.wantMatched))
			}
			for i, r := range results {
				if r.Matched != tt.wantMatched[i] {
					t.Errorf("token[%d] matched=%v, want %v", i, r.Matched, tt.wantMatched[i])
				}
			}
		})
	}
}

func TestDeterministicTokens(t *testing.T) {
	key := []byte("deterministic-key")

	tests := []struct {
		name   string
		input1 string
		input2 string
		same   bool
	}{
		{
			name: "same name same token", input1: "Test Name",
			input2: "Test Name", same: true,
		},
		{
			name: "different name different token", input1: "Name A",
			input2: "Name B", same: false,
		},
		{
			name: "case insensitive same token", input1: "JOHN DOE",
			input2: "john doe", same: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t1 := GenerateTokens([]string{tt.input1}, key)
			t2 := GenerateTokens([]string{tt.input2}, key)
			equal := bytes.Equal(t1[0], t2[0])
			if equal != tt.same {
				t.Errorf("tokens equal=%v, want %v", equal, tt.same)
			}
		})
	}
}
