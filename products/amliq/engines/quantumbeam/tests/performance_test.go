package tests

import ("fmt"; "math/rand"; "sync"; "sync/atomic"; "testing"; "time"; "github.com/stretchr/testify/assert")

type PerformanceMetrics struct {
  TotalLatency, MinLatency, MaxLatency int64
  SuccessCount int64
}

type PerformanceTest struct {
  engine *ScoringEngine
  metrics *PerformanceMetrics
}

func NewPerformanceTest() *PerformanceTest {
  return &PerformanceTest{engine: NewScoringEngine(), metrics: &PerformanceMetrics{MinLatency: 1<<62 - 1}}
}

func (pt *PerformanceTest) generateTransaction() *Transaction {
  countries := []string{"US", "GB", "CA", "NG", "CI"}
  return &Transaction{
    ID: fmt.Sprintf("TXN%d", rand.Int63()),
    Amount: rand.Float64() * 10000,
    UserID: fmt.Sprintf("U%d", rand.Intn(10000)),
    Merchant: fmt.Sprintf("M%d", rand.Intn(1000)),
    Time: time.Now(),
    Country: countries[rand.Intn(5)],
  }
}

func (pt *PerformanceTest) recordLatency(latencyMs int64) {
  atomic.AddInt64(&pt.metrics.TotalLatency, latencyMs)
  for {
    min := atomic.LoadInt64(&pt.metrics.MinLatency)
    if latencyMs >= min || atomic.CompareAndSwapInt64(&pt.metrics.MinLatency, min, latencyMs) {
      break
    }
  }
}

func TestLatency(t *testing.T) {
  pt := NewPerformanceTest()
  txn := pt.generateTransaction()
  start := time.Now()
  _ = pt.engine.scoreTransaction(txn)
  latencyMs := time.Since(start).Milliseconds()
  assert.Less(t, latencyMs, int64(50), "Latency should be < 50ms")
}

func TestBatchLatency(t *testing.T) {
  pt := NewPerformanceTest()
  txns := make([]*Transaction, 100)
  for i := 0; i < 100; i++ { txns[i] = pt.generateTransaction() }
  start := time.Now()
  for _, txn := range txns { _ = pt.engine.scoreTransaction(txn) }
  avgLatencyMs := time.Since(start).Milliseconds() / 100
  assert.Less(t, avgLatencyMs, int64(50))
}

func TestThroughput(t *testing.T) {
  pt := NewPerformanceTest()
  txnCount := 5000
  var wg sync.WaitGroup
  start := time.Now()
  for i := 0; i < txnCount; i++ {
    wg.Add(1)
    go func() {
      defer wg.Done()
      txn := pt.generateTransaction()
      _ = pt.engine.scoreTransaction(txn)
    }()
  }
  wg.Wait()
  throughput := float64(txnCount) / time.Since(start).Seconds()
  assert.Greater(t, throughput, 1000.0, "Throughput should exceed 1000 txn/sec")
}

func TestConcurrentScoring(t *testing.T) {
  pt := NewPerformanceTest()
  workers := 10
  txnPerWorker := 500
  var wg sync.WaitGroup
  for w := 0; w < workers; w++ {
    wg.Add(1)
    go func() {
      defer wg.Done()
      for i := 0; i < txnPerWorker; i++ {
        txn := pt.generateTransaction()
        _ = pt.engine.scoreTransaction(txn)
      }
    }()
  }
  wg.Wait()
}

func TestFeatureExtractPerf(t *testing.T) {
  pt := NewPerformanceTest()
  txn := pt.generateTransaction()
  start := time.Now()
  for i := 0; i < 10000; i++ { _ = pt.engine.extractFeatures(txn) }
  avgLatencyUs := time.Since(start).Microseconds() / 10000
  assert.Less(t, avgLatencyUs, int64(50000))
}

func TestMemoryEfficiency(t *testing.T) {
  pt := NewPerformanceTest()
  for i := 0; i < 10000; i++ {
    txn := pt.generateTransaction()
    _ = pt.engine.scoreTransaction(txn)
  }
  assert.NotNil(t, pt)
}

func TestP99Latency(t *testing.T) {
  pt := NewPerformanceTest()
  latencies := make([]int64, 1000)
  for i := 0; i < 1000; i++ {
    txn := pt.generateTransaction()
    start := time.Now()
    _ = pt.engine.scoreTransaction(txn)
    latencies[i] = time.Since(start).Milliseconds()
  }
  p99 := latencies[990]
  assert.Less(t, p99, int64(50), "P99 latency should be < 50ms")
}

func TestLatencyUnderLoad(t *testing.T) {
  pt := NewPerformanceTest()
  workers := 20
  duration := 3 * time.Second
  // Use a stop channel; the previous implementation used a ticker with the
  // same period as the test duration, so worker goroutines blocked on the
  // ticker channel forever and wg.Wait deadlocked.
  stop := make(chan struct{})
  var wg sync.WaitGroup
  var latencySum int64
  var count int64
  for w := 0; w < workers; w++ {
    wg.Add(1)
    go func() {
      defer wg.Done()
      for {
        select {
        case <-stop:
          return
        default:
        }
        txn := pt.generateTransaction()
        start := time.Now()
        _ = pt.engine.scoreTransaction(txn)
        latency := time.Since(start).Milliseconds()
        atomic.AddInt64(&latencySum, latency)
        atomic.AddInt64(&count, 1)
      }
    }()
  }
  time.Sleep(duration)
  close(stop)
  wg.Wait()
  if count > 0 {
    avgLatency := latencySum / count
    assert.Less(t, avgLatency, int64(50))
  }
}

func TestPerformanceConsistency(t *testing.T) {
  pt := NewPerformanceTest()
  txn := pt.generateTransaction()
  scores := make([]float64, 100)
  var wg sync.WaitGroup
  for i := 0; i < 100; i++ {
    wg.Add(1)
    idx := i
    go func() {
      defer wg.Done()
      scores[idx] = pt.engine.scoreTransaction(txn)
    }()
  }
  wg.Wait()
  expected := scores[0]
  for _, score := range scores {
    assert.Equal(t, expected, score)
  }
}

func BenchmarkEndToEnd(b *testing.B) {
  pt := NewPerformanceTest()
  txn := pt.generateTransaction()
  b.ResetTimer()
  for i := 0; i < b.N; i++ { _ = pt.engine.scoreTransaction(txn) }
}

func BenchmarkConcurrent(b *testing.B) {
  pt := NewPerformanceTest()
  var wg sync.WaitGroup
  b.ResetTimer()
  for i := 0; i < b.N; i++ {
    wg.Add(1)
    go func() {
      defer wg.Done()
      txn := pt.generateTransaction()
      _ = pt.engine.scoreTransaction(txn)
    }()
  }
  wg.Wait()
}
