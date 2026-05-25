package rbac

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

type fakeLoader struct {
	perms []Permission
	calls int32
	err   error
}

func (f *fakeLoader) LoadPermissions(_ context.Context, _ uuid.UUID) ([]Permission, error) {
	atomic.AddInt32(&f.calls, 1)
	return f.perms, f.err
}

func TestAllow_DenyByDefault(t *testing.T) {
	e := NewEvaluator(&fakeLoader{perms: []Permission{}}, time.Minute)
	ok, err := e.Allow(context.Background(), uuid.New(), "audit:read")
	if err != nil || ok {
		t.Fatalf("empty grant must deny, got ok=%v err=%v", ok, err)
	}
}

func TestAllow_ExactMatch(t *testing.T) {
	e := NewEvaluator(&fakeLoader{perms: []Permission{"audit:read"}}, time.Minute)
	ok, _ := e.Allow(context.Background(), uuid.New(), "audit:read")
	if !ok {
		t.Fatal("exact match must allow")
	}
}

func TestAllow_GrantedNarrower_MatchesScopedRequired(t *testing.T) {
	// granted "audit:read" should also satisfy "audit:read:tenant"
	e := NewEvaluator(&fakeLoader{perms: []Permission{"audit:read"}}, time.Minute)
	ok, _ := e.Allow(context.Background(), uuid.New(), "audit:read:tenant")
	if !ok {
		t.Fatal("narrower granted should match scoped required")
	}
}

func TestAllow_RequiredNarrower_DoesNotMatch(t *testing.T) {
	// granted "audit:read:tenant" must NOT satisfy "audit:read"
	e := NewEvaluator(&fakeLoader{perms: []Permission{"audit:read:tenant"}}, time.Minute)
	ok, _ := e.Allow(context.Background(), uuid.New(), "audit:read")
	if ok {
		t.Fatal("longer granted must not match shorter required")
	}
}

func TestAllow_Wildcard(t *testing.T) {
	e := NewEvaluator(&fakeLoader{perms: []Permission{"*:*:*"}}, time.Minute)
	ok, _ := e.Allow(context.Background(), uuid.New(), "billing:write:tenant")
	if !ok {
		t.Fatal("super-wildcard must match")
	}
}

func TestAllow_PartialWildcard(t *testing.T) {
	e := NewEvaluator(&fakeLoader{perms: []Permission{"audit:*"}}, time.Minute)
	ok, _ := e.Allow(context.Background(), uuid.New(), "audit:read")
	if !ok {
		t.Fatal("audit:* must match audit:read")
	}
	ok, _ = e.Allow(context.Background(), uuid.New(), "billing:read")
	if ok {
		t.Fatal("audit:* must NOT match billing:read")
	}
}

func TestAllow_Caches(t *testing.T) {
	loader := &fakeLoader{perms: []Permission{"x:y"}}
	e := NewEvaluator(loader, time.Minute)
	uid := uuid.New()
	_, _ = e.Allow(context.Background(), uid, "x:y")
	_, _ = e.Allow(context.Background(), uid, "x:y")
	_, _ = e.Allow(context.Background(), uid, "x:y")
	if got := atomic.LoadInt32(&loader.calls); got != 1 {
		t.Fatalf("loader must be called once on cache hits, called %d", got)
	}
}

func TestAllow_InvalidateForcesReload(t *testing.T) {
	loader := &fakeLoader{perms: []Permission{"x:y"}}
	e := NewEvaluator(loader, time.Minute)
	uid := uuid.New()
	_, _ = e.Allow(context.Background(), uid, "x:y")
	e.Invalidate(uid)
	_, _ = e.Allow(context.Background(), uid, "x:y")
	if got := atomic.LoadInt32(&loader.calls); got != 2 {
		t.Fatalf("Invalidate must force a reload, called %d", got)
	}
}

func TestAllow_CacheTTLExpires(t *testing.T) {
	loader := &fakeLoader{perms: []Permission{"x:y"}}
	e := NewEvaluator(loader, time.Minute)
	current := time.Unix(1_700_000_000, 0)
	e.now = func() time.Time { return current }
	uid := uuid.New()

	_, _ = e.Allow(context.Background(), uid, "x:y")
	// Advance past TTL.
	current = current.Add(2 * time.Minute)
	_, _ = e.Allow(context.Background(), uid, "x:y")
	if got := atomic.LoadInt32(&loader.calls); got != 2 {
		t.Fatalf("expired cache must reload, called %d", got)
	}
}

func TestAllow_LoaderErrorPropagates(t *testing.T) {
	want := errors.New("db down")
	loader := &fakeLoader{err: want}
	e := NewEvaluator(loader, time.Minute)
	_, err := e.Allow(context.Background(), uuid.New(), "x:y")
	if !errors.Is(err, want) {
		t.Fatalf("loader error must propagate, got %v", err)
	}
}
