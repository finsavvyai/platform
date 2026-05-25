package screening

import "testing"

func TestBloomFilter(t *testing.T) {
	tests := []struct {
		name     string
		add      []string
		check    string
		wantHit  bool
	}{
		{
			name:    "known item returns true",
			add:     []string{"osama bin laden"},
			check:   "osama bin laden",
			wantHit: true,
		},
		{
			name:    "unknown item returns false",
			add:     []string{"osama bin laden", "saddam hussein"},
			check:   "john smith",
			wantHit: false,
		},
		{
			name:    "case insensitive match",
			add:     []string{"Vladimir Putin"},
			check:   "vladimir putin",
			wantHit: true,
		},
		{
			name:    "punctuation stripped",
			add:     []string{"Al-Shabaab"},
			check:   "alshabaab",
			wantHit: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bf := NewBloom(1000, 0.001)
			for _, item := range tt.add {
				bf.Add(item)
			}
			got := bf.MayContain(tt.check)
			if got != tt.wantHit {
				t.Errorf("MayContain(%q) = %v, want %v", tt.check, got, tt.wantHit)
			}
		})
	}
}

func TestBloomCount(t *testing.T) {
	bf := NewBloom(100, 0.01)
	bf.Add("alice")
	bf.Add("bob")
	if bf.Count() != 2 {
		t.Errorf("Count() = %d, want 2", bf.Count())
	}
}

func TestBloomFalsePositiveRate(t *testing.T) {
	bf := NewBloom(10000, 0.01)
	for i := 0; i < 10000; i++ {
		bf.Add("sanctioned-" + string(rune('A'+i%26)) + string(rune('0'+i%10)))
	}
	fps := 0
	trials := 50000
	for i := 0; i < trials; i++ {
		name := "unknown-" + string(rune('a'+i%26)) + string(rune(i%1000))
		if bf.MayContain(name) {
			fps++
		}
	}
	rate := float64(fps) / float64(trials)
	if rate > 0.05 {
		t.Errorf("FP rate %.4f too high (want < 0.05)", rate)
	}
}

func TestBloomMemory(t *testing.T) {
	bf := NewBloom(1000000, 0.001)
	mb := bf.MemoryBytes() / (1024 * 1024)
	if mb > 5 {
		t.Errorf("MemoryBytes = %d MB, want < 5 MB for 1M items", mb)
	}
}
