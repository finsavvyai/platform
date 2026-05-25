package mesh

import (
	"net/http"
	"sync"
	"testing"
	"time"
)

type fakeSetter struct {
	got *http.Client
}

func (f *fakeSetter) SetHTTPClient(c *http.Client) { f.got = c }

func resetMeshState() {
	mu.Lock()
	defer mu.Unlock()
	meshClient = nil
	initialized = false
}

func TestApply_NoMesh_NoOp(t *testing.T) {
	resetMeshState()
	t.Cleanup(resetMeshState)

	f := &fakeSetter{}
	if Apply(f) {
		t.Fatalf("Apply must return false when mesh inactive")
	}
	if f.got != nil {
		t.Fatalf("setter must not be called when mesh inactive")
	}
}

func TestApply_WithMesh_InjectsClient(t *testing.T) {
	resetMeshState()
	t.Cleanup(resetMeshState)

	want := &http.Client{Timeout: time.Second}
	mu.Lock()
	meshClient = want
	initialized = true
	mu.Unlock()

	f := &fakeSetter{}
	if !Apply(f) {
		t.Fatalf("Apply must return true when mesh active and setter supported")
	}
	if f.got != want {
		t.Fatalf("expected mesh client to be injected, got %p want %p", f.got, want)
	}
}

func TestApply_NonSetterIgnored(t *testing.T) {
	resetMeshState()
	t.Cleanup(resetMeshState)

	mu.Lock()
	meshClient = &http.Client{}
	initialized = true
	mu.Unlock()

	if Apply(struct{}{}) {
		t.Fatalf("Apply must return false for types that do not implement HTTPClientSetter")
	}
}

func TestApply_RaceSafety(t *testing.T) {
	resetMeshState()
	t.Cleanup(resetMeshState)

	mu.Lock()
	meshClient = &http.Client{}
	initialized = true
	mu.Unlock()

	var wg sync.WaitGroup
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			Apply(&fakeSetter{})
		}()
	}
	wg.Wait()
}
