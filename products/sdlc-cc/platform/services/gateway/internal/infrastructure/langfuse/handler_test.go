package langfuse

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingTraceSink struct {
	mu     sync.Mutex
	traces []Trace
}

func (r *recordingTraceSink) Record(_ context.Context, _ string, t Trace) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.traces = append(r.traces, t)
	return nil
}

type recordingScoreSink struct {
	mu     sync.Mutex
	scores []Score
}

func (r *recordingScoreSink) Record(_ context.Context, _ string, s Score) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scores = append(r.scores, s)
	return nil
}

func newHandler(t *testing.T) (*chi.Mux, *recordingTraceSink, *recordingScoreSink, *MemoryPromptStore) {
	t.Helper()
	traces := &recordingTraceSink{}
	scores := &recordingScoreSink{}
	prompts := NewMemoryPromptStore()
	h := &Handler{
		BasicAuth: func(pk, sk string) (string, error) {
			if pk == "pk_acme" && sk == "sk_acme" {
				return "acme", nil
			}
			return "", errors.New("nope")
		},
		BearerAuth: func(tok string) (string, error) {
			if tok == "good-token" {
				return "globex", nil
			}
			return "", errors.New("nope")
		},
		Traces:  traces,
		Scores:  scores,
		Prompts: prompts,
	}
	r := chi.NewRouter()
	h.Mount(r)
	return r, traces, scores, prompts
}

func basic(pk, sk string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(pk+":"+sk))
}

func TestPostTraces_BasicAuth(t *testing.T) {
	r, traces, _, _ := newHandler(t)
	body, _ := json.Marshal(Trace{ID: "t1", Name: "demo"})
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	require.Len(t, traces.traces, 1)
	assert.Equal(t, "t1", traces.traces[0].ID)
}

func TestPostTraces_BearerAuth(t *testing.T) {
	r, traces, _, _ := newHandler(t)
	body, _ := json.Marshal(Trace{ID: "t2"})
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer good-token")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	assert.Len(t, traces.traces, 1)
}

func TestPostTraces_NoAuth_401(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestPostScores_RequiresTraceIDAndName(t *testing.T) {
	r, _, _, _ := newHandler(t)
	body, _ := json.Marshal(Score{Name: "quality"})
	req := httptest.NewRequest(http.MethodPost, "/api/public/scores", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostScores_OK(t *testing.T) {
	r, _, scores, _ := newHandler(t)
	v := 0.92
	body, _ := json.Marshal(Score{ID: "s1", TraceID: "t1", Name: "quality", Value: &v})
	req := httptest.NewRequest(http.MethodPost, "/api/public/scores", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)
	assert.Equal(t, "quality", scores.scores[0].Name)
}

func TestPrompts_PutAndGetLatest(t *testing.T) {
	r, _, _, _ := newHandler(t)
	put := func(version int, text string) {
		body, _ := json.Marshal(Prompt{Name: "greeting", Version: version, Type: "text", Prompt: text})
		req := httptest.NewRequest(http.MethodPost, "/api/public/prompts", bytes.NewReader(body))
		req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, http.StatusCreated, w.Code)
	}
	put(1, "hello v1")
	put(2, "hello v2")

	req := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=greeting", nil)
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var p Prompt
	require.NoError(t, json.NewDecoder(w.Body).Decode(&p))
	assert.Equal(t, 2, p.Version)
	assert.Equal(t, "hello v2", p.Prompt)
}

func TestPrompts_GetVersion(t *testing.T) {
	r, _, _, _ := newHandler(t)
	body, _ := json.Marshal(Prompt{Name: "g", Version: 7, Type: "text", Prompt: "x"})
	req := httptest.NewRequest(http.MethodPost, "/api/public/prompts", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	r.ServeHTTP(httptest.NewRecorder(), req)

	get := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=g&version=7", nil)
	get.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, get)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestPrompts_NotFound_404(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=missing", nil)
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPrompts_AutoVersion(t *testing.T) {
	store := NewMemoryPromptStore()
	p1, err := store.Put(context.Background(), "acme", Prompt{Name: "x", Type: "text", Prompt: "a"})
	require.NoError(t, err)
	p2, err := store.Put(context.Background(), "acme", Prompt{Name: "x", Type: "text", Prompt: "b"})
	require.NoError(t, err)
	assert.Equal(t, 1, p1.Version)
	assert.Equal(t, 2, p2.Version)
}

func TestPrompts_RequiresName(t *testing.T) {
	store := NewMemoryPromptStore()
	_, err := store.Put(context.Background(), "acme", Prompt{Type: "text", Prompt: "x"})
	assert.Error(t, err)
}

func TestPostTraces_BadJSON_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", strings.NewReader("not-json"))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostScores_BadJSON_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/scores", strings.NewReader("not-json"))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostPrompt_BadJSON_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/prompts", strings.NewReader("not-json"))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestPostPrompt_StoreError_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	body, _ := json.Marshal(Prompt{Type: "text", Prompt: "x"}) // no name → store rejects
	req := httptest.NewRequest(http.MethodPost, "/api/public/prompts", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetPrompts_NoName_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/api/public/prompts", nil)
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetPrompts_BadVersion_400(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=x&version=abc", nil)
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetPrompts_VersionNotFound_404(t *testing.T) {
	r, _, _, _ := newHandler(t)
	body, _ := json.Marshal(Prompt{Name: "g", Version: 1, Type: "text", Prompt: "x"})
	req := httptest.NewRequest(http.MethodPost, "/api/public/prompts", bytes.NewReader(body))
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	r.ServeHTTP(httptest.NewRecorder(), req)

	get := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=g&version=999", nil)
	get.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, get)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPrompts_Disabled_503(t *testing.T) {
	h := &Handler{
		BasicAuth: func(_, _ string) (string, error) { return "acme", nil },
		// Prompts intentionally nil
	}
	r := chi.NewRouter()
	h.Mount(r)

	req := httptest.NewRequest(http.MethodGet, "/api/public/prompts?name=x", nil)
	req.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	post := httptest.NewRequest(http.MethodPost, "/api/public/prompts",
		strings.NewReader(`{"name":"x","prompt":"y"}`))
	post.Header.Set("Authorization", basic("pk_acme", "sk_acme"))
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, post)
	assert.Equal(t, http.StatusServiceUnavailable, w2.Code)
}

func TestAuth_BasicWithMalformedBase64_401(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Basic !!!not-base64!!!")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_BasicNoColon_401(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte("nocolon")))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_BearerEmpty_401(t *testing.T) {
	r, _, _, _ := newHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/api/public/traces", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer  ")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}
