package pipeline

import "testing"

func BenchmarkComputeLatencies(b *testing.B) {
	lats := make([]int64, 10000)
	for i := range lats {
		lats[i] = int64(i % 500)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		computeLatencies(lats)
	}
}

func BenchmarkMetrics_RecordScreening(b *testing.B) {
	m := NewMetrics(func() int { return 0 })
	for i := 0; i < b.N; i++ {
		m.RecordScreening(int64(i % 100))
	}
}

func BenchmarkMetrics_Stats(b *testing.B) {
	m := NewMetrics(func() int { return 0 })
	for i := 0; i < 5000; i++ {
		m.RecordScreening(int64(i % 500))
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.Stats()
	}
}
