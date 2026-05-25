package scim

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// memStore is an in-memory Store used by the tests. It enforces tenant
// scoping so we can verify isolation.
type memStore struct {
	mu    sync.Mutex
	seq   int
	users map[string]map[string]User // tenant -> id -> user
}

func newMemStore() *memStore {
	return &memStore{users: map[string]map[string]User{}}
}

func (m *memStore) tenant(id string) map[string]User {
	if m.users[id] == nil {
		m.users[id] = map[string]User{}
	}
	return m.users[id]
}

func (m *memStore) Create(ctx context.Context, u User) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t := m.tenant(u.TenantID)
	for _, existing := range t {
		if existing.UserName == u.UserName {
			return User{}, ErrConflict
		}
	}
	m.seq++
	u.ID = "id-" + string(rune('a'+m.seq-1))
	u.Meta = Meta{ResourceType: "User", Created: time.Now(), LastModified: time.Now()}
	t[u.ID] = u
	return u, nil
}

func (m *memStore) Get(ctx context.Context, tenantID, id string) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.tenant(tenantID)[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

func (m *memStore) Delete(ctx context.Context, tenantID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.tenant(tenantID)[id]; !ok {
		return ErrNotFound
	}
	delete(m.tenant(tenantID), id)
	return nil
}

func (m *memStore) Update(ctx context.Context, u User) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	existing, ok := m.tenant(u.TenantID)[u.ID]
	if !ok {
		return User{}, ErrNotFound
	}
	if u.UserName != "" {
		existing.UserName = u.UserName
	}
	existing.Active = u.Active
	existing.Meta.LastModified = time.Now()
	m.tenant(u.TenantID)[u.ID] = existing
	return existing, nil
}

func (m *memStore) Search(ctx context.Context, tenantID string, f Filter) ([]User, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []User
	for _, u := range m.tenant(tenantID) {
		if f.UserNameEq != "" && u.UserName != f.UserNameEq {
			continue
		}
		out = append(out, u)
	}
	return out, len(out), nil
}

func newHandler(t *testing.T, tenantFn TenantResolver) (*Handler, *memStore, *http.ServeMux) {
	t.Helper()
	store := newMemStore()
	h := &Handler{Store: store, Tenant: tenantFn, BasePath: "/scim/v2"}
	mux := http.NewServeMux()
	h.Register(mux)
	return h, store, mux
}

func staticTenant(id string) TenantResolver {
	return func(r *http.Request) (string, error) { return id, nil }
}

func newReq(method, url, body string) *http.Request {
	r := httptest.NewRequest(method, url, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/scim+json")
	return r
}

func TestCreateUser_201AndIDAssigned(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	body := `{"userName":"alice@example.com","active":true}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Users", body))

	assert.Equal(t, http.StatusCreated, rec.Code)
	var got User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, "alice@example.com", got.UserName)
	assert.Contains(t, got.Schemas, UserSchema)
	assert.Equal(t, "application/scim+json", rec.Header().Get("Content-Type"))
}

func TestCreateUser_MissingUserName_400(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Users", `{"active":true}`))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "userName required")
}

func TestCreateUser_Duplicate_409(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	body := `{"userName":"bob@example.com"}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPost, "/scim/v2/Users", body))
	require.Equal(t, http.StatusCreated, rec.Code)

	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, newReq(http.MethodPost, "/scim/v2/Users", body))
	assert.Equal(t, http.StatusConflict, rec2.Code)
	assert.Contains(t, rec2.Body.String(), "uniqueness")
}

func TestGetUser_NotFound_404(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users/ghost", ""))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestGetUser_Found(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "c@x.com", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users/"+created.ID, ""))
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestDeleteUser_204(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "d@x.com", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodDelete, "/scim/v2/Users/"+created.ID, ""))
	assert.Equal(t, http.StatusNoContent, rec.Code)

	// Second delete returns 404
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, newReq(http.MethodDelete, "/scim/v2/Users/"+created.ID, ""))
	assert.Equal(t, http.StatusNotFound, rec2.Code)
}

func TestPatchUser_ReplaceActive(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "p@x.com", TenantID: "t1", Active: true})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[{"op":"Replace","path":"active","value":false}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	got, _ := store.Get(context.Background(), "t1", created.ID)
	assert.False(t, got.Active)
	// Critical security invariant: userName must NOT have been wiped.
	assert.Equal(t, "p@x.com", got.UserName)
}

func TestPatchUser_PreservesUntouchedFields(t *testing.T) {
	// Regression test for the H3 finding: the old PATCH impl treated the
	// body as a full User, causing { active:false } to null out userName.
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{
		UserName: "preserve@x.com",
		TenantID: "t1",
		Active:   true,
		Name:     UserName{GivenName: "Pre", FamilyName: "Serve"},
	})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[{"op":"replace","path":"active","value":false}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	require.Equal(t, http.StatusOK, rec.Code)

	got, _ := store.Get(context.Background(), "t1", created.ID)
	assert.Equal(t, "preserve@x.com", got.UserName, "userName must survive PATCH")
	assert.Equal(t, "Pre", got.Name.GivenName, "name must survive PATCH")
	assert.False(t, got.Active)
}

func TestPatchUser_RejectsMissingPatchSchema(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "r@x.com", TenantID: "t1"})

	body := `{"Operations":[{"op":"replace","path":"active","value":false}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), PatchOpSchema)
}

func TestPatchUser_RejectsEmptyOperations(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "e@x.com", TenantID: "t1"})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPatchUser_UnsupportedPathRejected(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "u@x.com", TenantID: "t1"})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[{"op":"replace","path":"roles","value":["admin"]}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "unsupported path")
}

func TestPatchUser_BodyLevelReplace(t *testing.T) {
	// Okta often sends a single Replace with no path and a full-object value.
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{
		UserName: "body@x.com", TenantID: "t1", Active: true,
	})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[{"op":"Replace","value":{"active":false}}]}`
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body))
	require.Equal(t, http.StatusOK, rec.Code)

	got, _ := store.Get(context.Background(), "t1", created.ID)
	assert.False(t, got.Active)
	assert.Equal(t, "body@x.com", got.UserName, "body-level Replace must not null unlisted fields")
}

func TestPutUser_FullReplace(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "put@x.com", TenantID: "t1", Active: true})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPut, "/scim/v2/Users/"+created.ID,
		`{"userName":"put2@x.com","active":false}`))
	require.Equal(t, http.StatusOK, rec.Code)

	got, _ := store.Get(context.Background(), "t1", created.ID)
	assert.Equal(t, "put2@x.com", got.UserName)
	assert.False(t, got.Active)
}

func TestSearch_FilterByUserName(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	_, _ = store.Create(context.Background(), User{UserName: "alice@x", TenantID: "t1"})
	_, _ = store.Create(context.Background(), User{UserName: "bob@x", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, `/scim/v2/Users?filter=userName+eq+%22alice%40x%22`, ""))
	require.Equal(t, http.StatusOK, rec.Code)

	var resp map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.EqualValues(t, 1, resp["totalResults"])
}

func TestSearch_ListsAllWithoutFilter(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	_, _ = store.Create(context.Background(), User{UserName: "a@x", TenantID: "t1"})
	_, _ = store.Create(context.Background(), User{UserName: "b@x", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users", ""))
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"totalResults":2`)
}

func TestTenantIsolation_CrossTenantGet404(t *testing.T) {
	// Same store, handler per tenant
	store := newMemStore()
	ah := &Handler{Store: store, Tenant: staticTenant("tenant-a"), BasePath: "/scim/v2"}
	bh := &Handler{Store: store, Tenant: staticTenant("tenant-b"), BasePath: "/scim/v2"}
	muxA := http.NewServeMux()
	ah.Register(muxA)
	muxB := http.NewServeMux()
	bh.Register(muxB)

	created, _ := store.Create(context.Background(), User{UserName: "t@x", TenantID: "tenant-a"})

	// tenant-b must NOT see tenant-a's user
	rec := httptest.NewRecorder()
	muxB.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users/"+created.ID, ""))
	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestUnauthorized_WhenTenantResolverFails(t *testing.T) {
	failing := func(r *http.Request) (string, error) { return "", errors.New("no tenant") }
	h := &Handler{Store: newMemStore(), Tenant: failing, BasePath: "/scim/v2"}
	mux := http.NewServeMux()
	h.Register(mux)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users", ""))
	assert.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestMethodNotAllowed(t *testing.T) {
	_, _, mux := newHandler(t, staticTenant("t1"))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPut, "/scim/v2/Users", ""))
	assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
}

func TestParseUserNameEq(t *testing.T) {
	cases := map[string]string{
		"":                              "",
		`userName eq "alice"`:           "alice",
		`USERNAME EQ "alice"`:           "alice",
		`userName eq alice`:             "alice",
		`familyName eq "alice"`:         "",
		`userName eq "with spaces @x"`:  "with spaces @x",
	}
	for input, want := range cases {
		t.Run(input, func(t *testing.T) {
			assert.Equal(t, want, parseUserNameEq(input))
		})
	}
}

func TestParseIntDefault(t *testing.T) {
	assert.Equal(t, 1, parseIntDefault("", 1))
	assert.Equal(t, 1, parseIntDefault("-5", 1))
	assert.Equal(t, 1, parseIntDefault("abc", 1))
	assert.Equal(t, 42, parseIntDefault("42", 1))
}
