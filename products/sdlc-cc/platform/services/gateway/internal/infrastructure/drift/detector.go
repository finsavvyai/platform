// DLP detection-rate drift detector. Claude Team D4 closeout. A
// spike or collapse in DLP-detection volume is either a leak being
// prevented or a misconfigured client; either way the security
// admin needs to know within an hour. The detector owns one
// stateless math function (twoSigmaDeviation) and a Run loop that
// hits a CountReader on a fixed cadence and dispatches a webhook
// when the latest sample drifts more than 2σ from the rolling
// 7-day baseline.
package drift

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// CountReader returns the per-tenant DLP detection counts for one
// hour bucket plus the trailing 7-day window. The split lets the
// detector compute both the latest sample and the baseline in a
// single SQL round-trip.
type CountReader interface {
	HourlyCounts(ctx context.Context, tenantID uuid.UUID, end time.Time) (HourlyCounts, error)
	ActiveTenants(ctx context.Context) ([]uuid.UUID, error)
}

// HourlyCounts is the per-tenant input the detector needs.
type HourlyCounts struct {
	Latest int       // detections in the most recent full hour
	Window []int     // 168 hourly buckets ending at the latest
	EndAt  time.Time // wall clock of the latest bucket end
}

// Dispatcher is the webhook delivery interface. The middleware's
// Day-38 dispatcher already implements this shape, so D4 reuses
// the same fan-out without touching it.
type Dispatcher interface {
	Dispatch(ctx context.Context, tenantID uuid.UUID, eventType string, payload []byte) (int, error)
}

// Logger is the optional warning sink. nil falls through silently.
type Logger func(msg string, err error)

// Detector wires the tickerless decision logic. Run starts the
// per-hour loop using the configured Interval and Threshold.
type Detector struct {
	Reader     CountReader
	Dispatcher Dispatcher
	Threshold  float64       // sigma multiplier; 2.0 default
	Interval   time.Duration // tick cadence; 1h default
	Now        func() time.Time
	Log        Logger
}

// NewDetector returns a detector with sensible defaults.
func NewDetector(reader CountReader, dispatcher Dispatcher) *Detector {
	if reader == nil {
		panic("drift: reader required")
	}
	return &Detector{
		Reader:     reader,
		Dispatcher: dispatcher,
		Threshold:  2.0,
		Interval:   time.Hour,
		Now:        time.Now,
	}
}

// Verdict is the per-tenant outcome of one tick.
type Verdict struct {
	TenantID    uuid.UUID
	Latest      int
	BaselineAvg float64
	BaselineStd float64
	ZScore      float64
	Direction   string // "spike" | "collapse" | "normal"
}

// Tick runs one evaluation pass over every active tenant. Returns
// the verdicts that triggered a webhook (z-score > threshold).
// Exported so tests can drive the detector without a goroutine.
func (d *Detector) Tick(ctx context.Context) ([]Verdict, error) {
	tenants, err := d.Reader.ActiveTenants(ctx)
	if err != nil {
		return nil, fmt.Errorf("drift: tenants: %w", err)
	}
	now := d.now()
	threshold := d.Threshold
	if threshold <= 0 {
		threshold = 2.0
	}
	var fired []Verdict
	for _, tid := range tenants {
		counts, cerr := d.Reader.HourlyCounts(ctx, tid, now)
		if cerr != nil {
			d.warn("drift: counts", cerr)
			continue
		}
		v := evaluate(tid, counts, threshold)
		if v.Direction == "normal" {
			continue
		}
		if d.Dispatcher != nil {
			payload, _ := json.Marshal(map[string]any{
				"tenant_id":     v.TenantID.String(),
				"latest":        v.Latest,
				"baseline_avg":  v.BaselineAvg,
				"baseline_std":  v.BaselineStd,
				"z_score":       v.ZScore,
				"direction":     v.Direction,
				"detected_at":   counts.EndAt,
			})
			if _, derr := d.Dispatcher.Dispatch(ctx, tid, "dlp.drift.alert", payload); derr != nil {
				d.warn("drift: dispatch", derr)
			}
		}
		fired = append(fired, v)
	}
	return fired, nil
}

// Run blocks until ctx is done, ticking once per Interval. Each
// tick is best-effort — errors are logged and the loop continues.
// Use Tick directly for tests.
func (d *Detector) Run(ctx context.Context) {
	interval := d.Interval
	if interval <= 0 {
		interval = time.Hour
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if _, err := d.Tick(ctx); err != nil {
				d.warn("drift: tick", err)
			}
		}
	}
}

// evaluate is the pure decision function. Given the per-tenant
// counts + threshold, return the verdict. Splits the math out of
// Tick so the test suite can hammer it directly without a Reader.
func evaluate(tenantID uuid.UUID, counts HourlyCounts, threshold float64) Verdict {
	v := Verdict{TenantID: tenantID, Latest: counts.Latest}
	avg, std := twoSigmaDeviation(counts.Window)
	v.BaselineAvg = avg
	v.BaselineStd = std
	if std == 0 {
		// Flat baseline. The only interesting case is "previously
		// silent, now talking" (latest>0, avg==0) which is a spike
		// from absolute zero. Anything else (including the latest
		// matching a flat-constant baseline) is normal.
		if counts.Latest > 0 && avg == 0 {
			v.ZScore = math.Inf(1)
			v.Direction = "spike"
			return v
		}
		v.Direction = "normal"
		return v
	}
	z := (float64(counts.Latest) - avg) / std
	v.ZScore = z
	switch {
	case z >= threshold:
		v.Direction = "spike"
	case z <= -threshold:
		v.Direction = "collapse"
	default:
		v.Direction = "normal"
	}
	return v
}

// twoSigmaDeviation returns (mean, sample standard deviation) over
// the window. Excludes the latest sample so the comparison is
// against history, not history-plus-self.
func twoSigmaDeviation(window []int) (float64, float64) {
	if len(window) <= 1 {
		return 0, 0
	}
	hist := window[:len(window)-1]
	var sum float64
	for _, v := range hist {
		sum += float64(v)
	}
	mean := sum / float64(len(hist))
	var sq float64
	for _, v := range hist {
		d := float64(v) - mean
		sq += d * d
	}
	std := math.Sqrt(sq / float64(len(hist)))
	return mean, std
}

func (d *Detector) now() time.Time {
	if d.Now != nil {
		return d.Now()
	}
	return time.Now().UTC()
}

func (d *Detector) warn(msg string, err error) {
	if d.Log == nil {
		return
	}
	d.Log(msg, err)
}

// ErrNoBaseline is returned by HourlyCounts implementations when
// there's not enough history to compute a baseline. The detector
// treats it as "normal" rather than a spike.
var ErrNoBaseline = errors.New("drift: insufficient baseline window")
