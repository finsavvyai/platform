package health

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// ProbeStatus represents Kubernetes probe status
type ProbeStatus string

const (
	ProbePass ProbeStatus = "pass"
	ProbeFail ProbeStatus = "fail"
	ProbeWarn ProbeStatus = "warn"
)

// Checker is a function that checks the health of a dependency
type Checker func(ctx context.Context) CheckDetail

// CheckDetail describes the result of a single health check
type CheckDetail struct {
	ComponentID   string      `json:"componentId,omitempty"`
	ComponentType string      `json:"componentType,omitempty"`
	Status        ProbeStatus `json:"status"`
	ObservedValue interface{} `json:"observedValue,omitempty"`
	ObservedUnit  string      `json:"observedUnit,omitempty"`
	Time          string      `json:"time"`
	Output        string      `json:"output,omitempty"`
}

// ProbeResponse follows the IETF Health Check Response Format (draft-inadarei-api-health-check)
type ProbeResponse struct {
	Status      ProbeStatus              `json:"status"`
	Version     string                   `json:"version,omitempty"`
	ReleaseID   string                   `json:"releaseId,omitempty"`
	ServiceID   string                   `json:"serviceId,omitempty"`
	Description string                   `json:"description,omitempty"`
	Notes       []string                 `json:"notes,omitempty"`
	Output      string                   `json:"output,omitempty"`
	Checks      map[string][]CheckDetail `json:"checks,omitempty"`
}

// ServiceHealthContract provides standardized Kubernetes health endpoints
type ServiceHealthContract struct {
	mu             sync.RWMutex
	serviceName    string
	version        string
	releaseID      string
	startTime      time.Time
	ready          atomic.Bool
	livenessChecks map[string]Checker
	readyChecks    map[string]Checker
	startupChecks  map[string]Checker
	checkTimeout   time.Duration
}

// ContractOption configures the ServiceHealthContract
type ContractOption func(*ServiceHealthContract)

// WithVersion sets the service version
func WithVersion(v string) ContractOption {
	return func(c *ServiceHealthContract) { c.version = v }
}

// WithReleaseID sets the release identifier
func WithReleaseID(id string) ContractOption {
	return func(c *ServiceHealthContract) { c.releaseID = id }
}

// WithCheckTimeout sets the timeout for individual checks
func WithCheckTimeout(d time.Duration) ContractOption {
	return func(c *ServiceHealthContract) { c.checkTimeout = d }
}

// NewServiceHealthContract creates a new health contract handler
func NewServiceHealthContract(serviceName string, opts ...ContractOption) *ServiceHealthContract {
	c := &ServiceHealthContract{
		serviceName:    serviceName,
		startTime:      time.Now(),
		livenessChecks: make(map[string]Checker),
		readyChecks:    make(map[string]Checker),
		startupChecks:  make(map[string]Checker),
		checkTimeout:   3 * time.Second,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// AddLivenessCheck registers a check for /livez
func (c *ServiceHealthContract) AddLivenessCheck(name string, check Checker) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.livenessChecks[name] = check
}

// AddReadinessCheck registers a check for /readyz
func (c *ServiceHealthContract) AddReadinessCheck(name string, check Checker) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.readyChecks[name] = check
}

// AddStartupCheck registers a check for /healthz (startup)
func (c *ServiceHealthContract) AddStartupCheck(name string, check Checker) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.startupChecks[name] = check
}

// SetReady marks the service as ready to receive traffic
func (c *ServiceHealthContract) SetReady(ready bool) {
	c.ready.Store(ready)
}

// RegisterRoutes registers the health endpoints on an http.ServeMux
func (c *ServiceHealthContract) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", c.HealthzHandler)
	mux.HandleFunc("/readyz", c.ReadyzHandler)
	mux.HandleFunc("/livez", c.LivezHandler)
}

// HealthzHandler handles /healthz — basic startup/health probe
// Kubernetes uses this as the default health check
func (c *ServiceHealthContract) HealthzHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Check if verbose output requested
	verbose := r.URL.Query().Get("verbose") == "true"

	c.mu.RLock()
	checks := c.startupChecks
	c.mu.RUnlock()

	// If no startup checks registered, report pass if liveness checks pass
	if len(checks) == 0 {
		c.mu.RLock()
		checks = c.livenessChecks
		c.mu.RUnlock()
	}

	resp := c.runChecks(r.Context(), checks, verbose)
	resp.Description = c.serviceName + " health status"
	c.writeResponse(w, resp)
}

// ReadyzHandler handles /readyz — readiness probe
// Returns 200 only when the service is ready to accept traffic
func (c *ServiceHealthContract) ReadyzHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	verbose := r.URL.Query().Get("verbose") == "true"

	// Quick check: if not explicitly marked ready, fail fast
	if !c.ready.Load() {
		resp := &ProbeResponse{
			Status:      ProbeFail,
			Version:     c.version,
			ReleaseID:   c.releaseID,
			Description: c.serviceName + " readiness status",
			Output:      "service not yet marked ready",
		}
		c.writeResponse(w, resp)
		return
	}

	c.mu.RLock()
	checks := c.readyChecks
	c.mu.RUnlock()

	resp := c.runChecks(r.Context(), checks, verbose)
	resp.Description = c.serviceName + " readiness status"
	c.writeResponse(w, resp)
}

// LivezHandler handles /livez — liveness probe
// Returns 200 if the process is alive and not deadlocked
func (c *ServiceHealthContract) LivezHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	verbose := r.URL.Query().Get("verbose") == "true"

	c.mu.RLock()
	checks := c.livenessChecks
	c.mu.RUnlock()

	// If no liveness checks, just return pass (process is alive)
	if len(checks) == 0 {
		resp := &ProbeResponse{
			Status:      ProbePass,
			Version:     c.version,
			ReleaseID:   c.releaseID,
			Description: c.serviceName + " liveness status",
		}
		c.writeResponse(w, resp)
		return
	}

	resp := c.runChecks(r.Context(), checks, verbose)
	resp.Description = c.serviceName + " liveness status"
	c.writeResponse(w, resp)
}

// runChecks executes all registered checks concurrently with a timeout
func (c *ServiceHealthContract) runChecks(ctx context.Context, checks map[string]Checker, verbose bool) *ProbeResponse {
	resp := &ProbeResponse{
		Status:    ProbePass,
		Version:   c.version,
		ReleaseID: c.releaseID,
		ServiceID: c.serviceName,
	}

	if verbose {
		resp.Checks = make(map[string][]CheckDetail)
	}

	if len(checks) == 0 {
		return resp
	}

	type result struct {
		name   string
		detail CheckDetail
	}

	results := make(chan result, len(checks))
	var wg sync.WaitGroup

	for name, check := range checks {
		wg.Add(1)
		go func(n string, ch Checker) {
			defer wg.Done()
			checkCtx, cancel := context.WithTimeout(ctx, c.checkTimeout)
			defer cancel()

			detail := ch(checkCtx)
			results <- result{name: n, detail: detail}
		}(name, check)
	}

	// Close results channel when all checks complete
	go func() {
		wg.Wait()
		close(results)
	}()

	for res := range results {
		if res.detail.Status == ProbeFail {
			resp.Status = ProbeFail
		} else if res.detail.Status == ProbeWarn && resp.Status != ProbeFail {
			resp.Status = ProbeWarn
		}

		if verbose {
			resp.Checks[res.name] = append(resp.Checks[res.name], res.detail)
		}
	}

	return resp
}

// writeResponse serializes and writes the probe response
func (c *ServiceHealthContract) writeResponse(w http.ResponseWriter, resp *ProbeResponse) {
	w.Header().Set("Content-Type", "application/health+json")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

	status := http.StatusOK
	if resp.Status == ProbeFail {
		status = http.StatusServiceUnavailable
	}

	w.WriteHeader(status)
	// Encode error after headers/status are sent is non-actionable. Discard is safe.
	_ = json.NewEncoder(w).Encode(resp)
}

// ── Built-in Checkers ────────────────────────────────────

// PingChecker creates a simple checker that pings a dependency
func PingChecker(name string, pingFn func(ctx context.Context) error) Checker {
	return func(ctx context.Context) CheckDetail {
		start := time.Now()
		err := pingFn(ctx)
		duration := time.Since(start)

		detail := CheckDetail{
			ComponentID:   name,
			ComponentType: "datastore",
			ObservedValue: duration.Milliseconds(),
			ObservedUnit:  "ms",
			Time:          time.Now().UTC().Format(time.RFC3339),
		}

		if err != nil {
			detail.Status = ProbeFail
			detail.Output = err.Error()
		} else {
			detail.Status = ProbePass
		}

		return detail
	}
}

// HTTPChecker creates a checker that probes an HTTP endpoint
func HTTPChecker(name, url string, timeout time.Duration) Checker {
	client := &http.Client{Timeout: timeout}
	return func(ctx context.Context) CheckDetail {
		start := time.Now()
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		resp, err := client.Do(req)
		duration := time.Since(start)

		detail := CheckDetail{
			ComponentID:   name,
			ComponentType: "http",
			ObservedValue: duration.Milliseconds(),
			ObservedUnit:  "ms",
			Time:          time.Now().UTC().Format(time.RFC3339),
		}

		if err != nil {
			detail.Status = ProbeFail
			detail.Output = err.Error()
			return detail
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			detail.Status = ProbePass
		} else {
			detail.Status = ProbeFail
			detail.Output = "unexpected status: " + resp.Status
		}

		return detail
	}
}

// ThresholdChecker creates a checker that warns/fails based on a numeric threshold
func ThresholdChecker(name string, valueFn func() float64, warnThreshold, failThreshold float64, unit string) Checker {
	return func(ctx context.Context) CheckDetail {
		val := valueFn()
		detail := CheckDetail{
			ComponentID:   name,
			ComponentType: "system",
			ObservedValue: val,
			ObservedUnit:  unit,
			Time:          time.Now().UTC().Format(time.RFC3339),
			Status:        ProbePass,
		}

		if val >= failThreshold {
			detail.Status = ProbeFail
		} else if val >= warnThreshold {
			detail.Status = ProbeWarn
		}

		return detail
	}
}
