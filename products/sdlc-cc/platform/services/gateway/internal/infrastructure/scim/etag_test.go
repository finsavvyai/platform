package scim

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestETag_HeaderEmittedOnGet(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "etag@x.com", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users/"+created.ID, ""))
	require.Equal(t, http.StatusOK, rec.Code)
	tag := rec.Header().Get("ETag")
	if tag == "" || !strings.HasPrefix(tag, `W/"`) {
		t.Fatalf("expected weak ETag header, got %q", tag)
	}

	var got User
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
	assert.Equal(t, tag, got.Meta.Version, "Meta.Version must equal the ETag")
}

func TestETag_PutWithoutIfMatchSucceeds(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "p@x.com", TenantID: "t1"})

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodPut, "/scim/v2/Users/"+created.ID,
		`{"userName":"p@x.com","active":false}`))
	assert.Equal(t, http.StatusOK, rec.Code, "If-Match is opt-in; absence must succeed")
}

func TestETag_PutWithMatchingIfMatchSucceeds(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "m@x.com", TenantID: "t1"})

	// First fetch the ETag.
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, newReq(http.MethodGet, "/scim/v2/Users/"+created.ID, ""))
	require.Equal(t, http.StatusOK, rec.Code)
	tag := rec.Header().Get("ETag")
	require.NotEmpty(t, tag)

	// PUT with matching If-Match.
	r := newReq(http.MethodPut, "/scim/v2/Users/"+created.ID,
		`{"userName":"m2@x.com"}`)
	r.Header.Set("If-Match", tag)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, r)
	assert.Equal(t, http.StatusOK, rec2.Code)
}

func TestETag_PutWithStaleIfMatchReturns412(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "s@x.com", TenantID: "t1"})

	r := newReq(http.MethodPut, "/scim/v2/Users/"+created.ID,
		`{"userName":"s2@x.com"}`)
	r.Header.Set("If-Match", `W/"1999-01-01T00:00:00Z"`)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	assert.Equal(t, http.StatusPreconditionFailed, rec.Code)
	assert.Contains(t, rec.Body.String(), "preconditionFailed")
}

func TestETag_PatchWithStaleIfMatchReturns412(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "ps@x.com", TenantID: "t1", Active: true})

	body := `{"schemas":["` + PatchOpSchema + `"],"Operations":[{"op":"replace","path":"active","value":false}]}`
	r := newReq(http.MethodPatch, "/scim/v2/Users/"+created.ID, body)
	r.Header.Set("If-Match", `W/"1999-01-01T00:00:00Z"`)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	assert.Equal(t, http.StatusPreconditionFailed, rec.Code)
}

func TestETag_WildcardIfMatchSucceeds(t *testing.T) {
	_, store, mux := newHandler(t, staticTenant("t1"))
	created, _ := store.Create(context.Background(), User{UserName: "w@x.com", TenantID: "t1"})

	r := newReq(http.MethodPut, "/scim/v2/Users/"+created.ID,
		`{"userName":"w2@x.com"}`)
	r.Header.Set("If-Match", "*")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, r)
	assert.Equal(t, http.StatusOK, rec.Code)
}
