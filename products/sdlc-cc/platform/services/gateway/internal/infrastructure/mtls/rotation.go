// Pluggable client-cert rotation. Day 37 of the production-ready
// roadmap.
//
// The existing mtls_manager.go owns SERVER cert rotation (it generates
// + signs them locally). This file adds CLIENT cert rotation: the
// gateway, when it talks outbound to other services, needs to present
// a cert that an external authority issued (Vault PKI in production,
// a file pair in dev/CI). Rotation here is "fetch from source on a
// timer; replace the in-flight tls.Certificate atomically".
//
// VaultCertSource is REAL and lives in vault_source.go — it uses
// github.com/hashicorp/vault/api to issue certs from a Vault PKI mount.
package mtls

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sirupsen/logrus"
)

// CertSource fetches the current client certificate. Implementations
// own where the cert lives (local file, Vault, AWS ACM, etc.) — the
// rotator only knows how to call Fetch on a schedule.
type CertSource interface {
	Fetch(ctx context.Context) (*tls.Certificate, error)
	Name() string
}

// Rotator periodically refreshes a tls.Certificate from a CertSource.
// Use Current() inside a tls.Config.GetClientCertificate hook so the
// new cert takes effect on the next handshake without a restart.
type Rotator struct {
	source   CertSource
	interval time.Duration
	logger   *logrus.Logger

	cert atomic.Pointer[tls.Certificate]

	stop    chan struct{}
	once    sync.Once
	done    chan struct{}
	started atomic.Bool // true once Start has spawned the loop goroutine
}

// NewRotator wires a Rotator. interval<=0 applies a 1-hour default.
// The first Fetch happens during NewRotator so a startup error
// surfaces before serve loops begin.
func NewRotator(ctx context.Context, source CertSource, interval time.Duration, logger *logrus.Logger) (*Rotator, error) {
	if source == nil {
		return nil, errors.New("mtls: rotator requires a CertSource")
	}
	if interval <= 0 {
		interval = time.Hour
	}
	if logger == nil {
		logger = logrus.New()
	}
	r := &Rotator{
		source:   source,
		interval: interval,
		logger:   logger,
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
	cert, err := source.Fetch(ctx)
	if err != nil {
		return nil, fmt.Errorf("mtls: initial Fetch from %s: %w", source.Name(), err)
	}
	r.cert.Store(cert)
	return r, nil
}

// Start launches the refresh goroutine. Idempotent — calling twice is
// a no-op so callers can wire it into multiple lifecycle hooks safely.
func (r *Rotator) Start(ctx context.Context) {
	if !r.started.CompareAndSwap(false, true) {
		return
	}
	go r.loop(ctx)
}

// Stop terminates the rotation loop. Safe to call multiple times, and
// safe to call when Start was never invoked (the test path that just
// uses NewRotator + Current()) — in that case there is nothing to wait
// on, so Stop returns immediately rather than deadlocking on r.done.
func (r *Rotator) Stop() {
	r.once.Do(func() { close(r.stop) })
	if r.started.Load() {
		<-r.done
	}
}

// Current returns the most recent cert. Safe to call from any
// goroutine — atomic.Pointer guarantees a coherent snapshot.
func (r *Rotator) Current() *tls.Certificate {
	return r.cert.Load()
}

// GetClientCertificate is the hook to plug into tls.Config.
func (r *Rotator) GetClientCertificate(_ *tls.CertificateRequestInfo) (*tls.Certificate, error) {
	c := r.cert.Load()
	if c == nil {
		return nil, errors.New("mtls: no certificate available")
	}
	return c, nil
}

func (r *Rotator) loop(ctx context.Context) {
	defer close(r.done)
	t := time.NewTicker(r.interval)
	defer t.Stop()
	for {
		select {
		case <-r.stop:
			return
		case <-ctx.Done():
			return
		case <-t.C:
			c, err := r.source.Fetch(ctx)
			if err != nil {
				r.logger.WithError(err).WithField("source", r.source.Name()).
					Warn("mtls: cert refresh failed; continuing with previous cert")
				continue
			}
			r.cert.Store(c)
			r.logger.WithField("source", r.source.Name()).Info("mtls: cert refreshed")
		}
	}
}

// FileCertSource reads a cert+key pair from disk on every Fetch. The
// rotator polls and re-reads, so external tooling (cert-manager,
// kubelet projection, etc.) only needs to overwrite the files in
// place.
type FileCertSource struct {
	CertFile string
	KeyFile  string
}

// Name implements CertSource.
func (f FileCertSource) Name() string { return "file:" + filepath.Base(f.CertFile) }

// Fetch implements CertSource.
func (f FileCertSource) Fetch(_ context.Context) (*tls.Certificate, error) {
	cf := filepath.Clean(f.CertFile)
	kf := filepath.Clean(f.KeyFile)
	if _, err := os.Stat(cf); err != nil {
		return nil, fmt.Errorf("cert file: %w", err)
	}
	if _, err := os.Stat(kf); err != nil {
		return nil, fmt.Errorf("key file: %w", err)
	}
	cert, err := tls.LoadX509KeyPair(cf, kf)
	if err != nil {
		return nil, fmt.Errorf("load key pair: %w", err)
	}
	return &cert, nil
}

// VaultCertSource is implemented in vault_source.go using the real
// hashicorp/vault/api library.
