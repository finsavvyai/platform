package screening

import "testing"

func TestBloomV2_AddAndContain(t *testing.T) {
	bf := NewBloomV2(10000, 0.001)
	bf.Add("vladimir putin")
	bf.Add("kim jong un")

	if !bf.MayContain("vladimir putin") {
		t.Error("expected bloom to contain 'vladimir putin'")
	}
	if !bf.MayContain("kim jong un") {
		t.Error("expected bloom to contain 'kim jong un'")
	}
	if bf.Count() != 2 {
		t.Errorf("expected count 2, got %d", bf.Count())
	}
}

func TestBloomV2_DefiniteNegative(t *testing.T) {
	bf := NewBloomV2(10000, 0.001)
	bf.Add("vladimir putin")

	// "john doe" was never added — bloom should (likely) return false
	if bf.MayContain("john doe") {
		t.Log("false positive for 'john doe' — rare but possible")
	}
}

func TestBloomV2_MemoryReasonable(t *testing.T) {
	bf := NewBloomV2(100000, 0.001)
	memKB := bf.MemoryBytes() / 1024
	if memKB > 300 {
		t.Errorf("bloom memory too large for 100K items: %dKB", memKB)
	}
}

func TestBloomV2_FPRate(t *testing.T) {
	bf := NewBloomV2(1000, 0.01)
	for i := 0; i < 1000; i++ {
		bf.Add("name_" + string(rune('a'+i%26)))
	}
	rate := bf.ApproxFPRate()
	if rate > 0.1 {
		t.Errorf("FP rate too high: %f", rate)
	}
}

func BenchmarkBloomV2_Add(b *testing.B) {
	bf := NewBloomV2(100000, 0.001)
	for i := 0; i < b.N; i++ {
		bf.Add("vladimir putin")
	}
}

func BenchmarkBloomV2_MayContain(b *testing.B) {
	bf := NewBloomV2(100000, 0.001)
	for i := 0; i < 10000; i++ {
		bf.Add("name_" + string(rune(i+'a')))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bf.MayContain("vladimir putin")
	}
}
