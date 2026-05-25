package scim

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type memGroupStore struct {
	mu     sync.Mutex
	seq    int
	groups map[string]map[string]Group // tenant -> id -> group
}

func newMemGroupStore() *memGroupStore {
	return &memGroupStore{groups: map[string]map[string]Group{}}
}

func (m *memGroupStore) tenant(id string) map[string]Group {
	if m.groups[id] == nil {
		m.groups[id] = map[string]Group{}
	}
	return m.groups[id]
}

func (m *memGroupStore) Create(_ context.Context, g Group) (Group, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t := m.tenant(g.TenantID)
	for _, existing := range t {
		if existing.DisplayName == g.DisplayName {
			return Group{}, ErrConflict
		}
	}
	m.seq++
	g.ID = "g-" + string(rune('a'+m.seq-1))
	g.Meta.ResourceType = "Group"
	if g.Meta.Created.IsZero() {
		g.Meta.Created = time.Now()
	}
	g.Meta.LastModified = time.Now()
	t[g.ID] = g
	return g, nil
}

func (m *memGroupStore) Get(_ context.Context, tenantID, id string) (Group, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	g, ok := m.tenant(tenantID)[id]
	if !ok {
		return Group{}, ErrNotFound
	}
	return g, nil
}

func (m *memGroupStore) Delete(_ context.Context, tenantID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.tenant(tenantID)[id]; !ok {
		return ErrNotFound
	}
	delete(m.tenant(tenantID), id)
	return nil
}

func (m *memGroupStore) Update(_ context.Context, g Group) (Group, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.tenant(g.TenantID)[g.ID]
	if !ok {
		return Group{}, ErrNotFound
	}
	if g.DisplayName != "" {
		existing.DisplayName = g.DisplayName
	}
	if g.Members != nil {
		existing.Members = g.Members
	}
	existing.Meta.LastModified = time.Now()
	m.tenant(g.TenantID)[g.ID] = existing
	return existing, nil
}

func (m *memGroupStore) Search(_ context.Context, tenantID string, _ Filter) ([]Group, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Group
	for _, g := range m.tenant(tenantID) {
		out = append(out, g)
	}
	return out, len(out), nil
}

func newGroupsHandler(t *testing.T, tenantFn TenantResolver) (*Handler, *memGroupStore, *http.ServeMux) {
	t.Helper()
	store := newMemStore()
	gstore := newMemGroupStore()
	h := &Handler{Store: store, GroupStore: gstore, Tenant: tenantFn, BasePath: "/scim/v2"}
	mux := http.NewServeMux()
	h.Register(mux)
	return h, gstore, mux
}

func TestGroups_CreateAndGet(t *testing.T) {
	_, _, mux := newGroupsHandler(t, staticTenant("t1"))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Groups",
		`{"displayName":"Engineering"}`))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, newReq(http.MethodGet, "/scim/v2/Groups", ""))
	require.Equal(t, http.StatusOK, rec2.Code)
	assert.Contains(t, rec2.Body.String(), "Engineering")
}

func TestGroups_DisabledWhenStoreNil(t *testing.T) {
	store := newMemStore()
	h := &Handler{Store: store, Tenant: staticTenant("t1"), BasePath: "/scim/v2"}
	mux := http.NewServeMux()
	h.Register(mux)

	rec := httptest.NewRecorder()
	// /Groups path is not even registered when GroupStore is nil; the
	// mux returns 404 — which is the "this server doesn't speak Groups"
	// signal SCIM clients should fall back from.
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Groups", ""))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGroups_DuplicateConflicts(t *testing.T) {
	_, _, mux := newGroupsHandler(t, staticTenant("t1"))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Groups",
		`{"displayName":"Eng"}`))
	require.Equal(t, http.StatusCreated, rec.Code)

	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, newReq(http.MethodPost, "/scim/v2/Groups",
		`{"displayName":"Eng"}`))
	assert.Equal(t, http.StatusConflict, rec2.Code)
}
