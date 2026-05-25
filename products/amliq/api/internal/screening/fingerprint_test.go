package screening

import "testing"

func TestGenerateFingerprints(t *testing.T) {
	tests := []struct {
		name     string
		fullName string
		wantMin  int // minimum number of fingerprints
		wantType FPType
		wantVal  string
	}{
		{
			name: "basic individual",
			fullName: "Vladimir Putin",
			wantMin:  6,
			wantType: FPNormalized,
			wantVal:  "vladimir putin",
		},
		{
			name: "comma separated",
			fullName: "PUTIN, Vladimir V.",
			wantMin:  5,
			wantType: FPNormalized,
			wantVal:  "putin vladimir v",
		},
		{
			name: "single word",
			fullName: "Madonna",
			wantMin:  3, // normalized + soundex + metaphone + dm
			wantType: FPNormalized,
			wantVal:  "madonna",
		},
		{
			name: "arabic name",
			fullName: "Mohammad Hassan",
			wantMin:  5,
			wantType: FPNormalized,
			wantVal:  "mohammad hassan",
		},
		{
			name: "empty name",
			fullName: "",
			wantMin:  0,
			wantType: 0,
			wantVal:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fps := generateTestFPs(tt.fullName)
			if len(fps) < tt.wantMin {
				t.Errorf("got %d fingerprints, want >= %d", len(fps), tt.wantMin)
			}
			if tt.wantVal != "" {
				found := false
				for _, fp := range fps {
					if fp.Type == tt.wantType && fp.Value == tt.wantVal {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("missing fp type=%d val=%q in %v",
						tt.wantType, tt.wantVal, fps)
				}
			}
		})
	}
}

func TestFingerprintTokenPairs(t *testing.T) {
	fps := generateTestFPs("Vladimir Putin")
	hasPair := false
	for _, fp := range fps {
		if fp.Type == FPTokenPair && fp.Value == "putin+vladimir" {
			hasPair = true
		}
	}
	if !hasPair {
		t.Error("missing token pair putin+vladimir")
	}
}

func TestFingerprintInitials(t *testing.T) {
	fps := generateTestFPs("Vladimir V Putin")
	hasInitials := false
	for _, fp := range fps {
		if fp.Type == FPInitials && fp.Value == "pvv" {
			hasInitials = true
		}
	}
	if !hasInitials {
		t.Error("missing initials 'pvv'")
	}
}

func TestFingerprintReversed(t *testing.T) {
	fps := generateTestFPs("Vladimir Putin")
	hasReversed := false
	for _, fp := range fps {
		if fp.Type == FPReversed && fp.Value == "putin vladimir" {
			hasReversed = true
		}
	}
	if !hasReversed {
		t.Error("missing reversed name 'putin vladimir'")
	}
}

func generateTestFPs(fullName string) []Fingerprint {
	return GenerateQueryFingerprints(fullName)
}
