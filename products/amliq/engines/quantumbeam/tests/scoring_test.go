package tests

import ("testing"; "time"; "github.com/stretchr/testify/assert")

type Transaction struct {
  ID, UserID, Merchant, Country string
  Amount float64
  Time time.Time
}

type ScoringEngine struct {
  thresholds map[string]float64
}

func NewScoringEngine() *ScoringEngine {
  return &ScoringEngine{thresholds: map[string]float64{"amount": 0.3}}
}

func (s *ScoringEngine) scoreTransaction(txn *Transaction) float64 {
  return s.scoreAmount(txn.Amount)
}

func (s *ScoringEngine) scoreAmount(amount float64) float64 {
  if amount > 10000 { return 0.9 }
  if amount > 5000 { return 0.7 }
  if amount > 1000 { return 0.4 }
  return 0.1
}

func (s *ScoringEngine) extractFeatures(txn *Transaction) map[string]float64 {
  return map[string]float64{"amount": txn.Amount, "hour": float64(txn.Time.Hour())}
}

func (s *ScoringEngine) inferRisk(features map[string]float64) float64 {
  risk := 0.0
  for k, v := range features {
    if w, ok := s.thresholds[k]; ok { risk += v * w }
  }
  return risk / 2.0
}

func TestBasicScoring(t *testing.T) {
  engine := NewScoringEngine()
  txn := &Transaction{ID: "TXN001", Amount: 1500.0, Time: time.Now()}
  score := engine.scoreTransaction(txn)
  assert.Greater(t, score, 0.0)
  assert.Less(t, score, 1.0)
}

func TestHighRisk(t *testing.T) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 15000.0}
  score := engine.scoreTransaction(txn)
  assert.Greater(t, score, 0.6)
}

func TestLowRisk(t *testing.T) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 50.0}
  score := engine.scoreTransaction(txn)
  assert.Less(t, score, 0.3)
}

func TestAmountScoring(t *testing.T) {
  engine := NewScoringEngine()
  tests := []struct{amt, min, max float64}{
    {100, 0.05, 0.15}, {1500, 0.35, 0.45}, {5500, 0.65, 0.75}, {15000, 0.85, 0.95},
  }
  for _, tt := range tests {
    score := engine.scoreAmount(tt.amt)
    assert.Greater(t, score, tt.min)
    assert.Less(t, score, tt.max)
  }
}

func TestFeatureExtraction(t *testing.T) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 500.0, Time: time.Date(2026, 3, 20, 14, 30, 0, 0, time.UTC)}
  features := engine.extractFeatures(txn)
  assert.NotEmpty(t, features)
  assert.Equal(t, 500.0, features["amount"])
}

func TestMLInference(t *testing.T) {
  engine := NewScoringEngine()
  features := map[string]float64{"amount": 500.0}
  risk := engine.inferRisk(features)
  assert.Greater(t, risk, 0.0)
}

func TestBatchScoring(t *testing.T) {
  engine := NewScoringEngine()
  txns := []*Transaction{
    {Amount: 100.0}, {Amount: 5000.0}, {Amount: 2000.0},
  }
  for i, txn := range txns {
    score := engine.scoreTransaction(txn)
    assert.Greater(t, score, 0.0, "txn %d", i)
  }
}

func TestEdgeCases(t *testing.T) {
  engine := NewScoringEngine()
  score := engine.scoreAmount(0.0)
  assert.Equal(t, 0.1, score)
  score = engine.scoreAmount(999999.0)
  assert.Equal(t, 0.9, score)
}

func TestConsistency(t *testing.T) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 750.0}
  s1 := engine.scoreTransaction(txn)
  s2 := engine.scoreTransaction(txn)
  assert.Equal(t, s1, s2)
}

func BenchmarkScoringEngine(b *testing.B) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 1500.0, Time: time.Now()}
  b.ResetTimer()
  for i := 0; i < b.N; i++ {
    _ = engine.scoreTransaction(txn)
  }
}

func BenchmarkFeatureExtraction(b *testing.B) {
  engine := NewScoringEngine()
  txn := &Transaction{Amount: 1500.0, Time: time.Now()}
  b.ResetTimer()
  for i := 0; i < b.N; i++ {
    _ = engine.extractFeatures(txn)
  }
}
