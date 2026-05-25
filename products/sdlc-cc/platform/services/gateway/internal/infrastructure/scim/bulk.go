// SCIM 2.0 /Bulk endpoint (RFC 7644 §3.7). Day 23: lets IdPs submit a
// batch of provisioning operations as a single request, instead of N
// HTTP round-trips per sync.
//
// We honor only the operations the rest of the package supports
// (User + Group CRUD); anything else returns a per-op 400 in the
// BulkResponse body so partial batches still succeed.
package scim

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
)

const (
	// BulkRequestSchema is the SCIM Bulk request envelope.
	BulkRequestSchema = "urn:ietf:params:scim:api:messages:2.0:BulkRequest"
	// BulkResponseSchema is the SCIM Bulk response envelope.
	BulkResponseSchema = "urn:ietf:params:scim:api:messages:2.0:BulkResponse"
	// defaultBulkLimit caps the number of operations per request when
	// the Handler does not set BulkLimit explicitly.
	defaultBulkLimit = 1000
)

// BulkRequest is the wire format for POST /Bulk.
type BulkRequest struct {
	Schemas      []string  `json:"schemas"`
	FailOnErrors int       `json:"failOnErrors,omitempty"`
	Operations   []BulkOp  `json:"Operations"`
}

// BulkOp is one operation inside a BulkRequest. Method+Path describe
// the operation; Data carries the resource body (for POST/PUT/PATCH).
type BulkOp struct {
	BulkID string          `json:"bulkId,omitempty"`
	Method string          `json:"method"`
	Path   string          `json:"path"`
	Data   json.RawMessage `json:"data,omitempty"`
}

// BulkResultOp is one entry in the BulkResponse Operations array.
type BulkResultOp struct {
	BulkID   string `json:"bulkId,omitempty"`
	Method   string `json:"method"`
	Location string `json:"location,omitempty"`
	Status   string `json:"status"`
	Response json.RawMessage `json:"response,omitempty"`
}

// bulk dispatches each operation back through the package's existing
// handlers so we do not duplicate validation logic.
func (h *Handler) bulk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "methodNotAllowed", "method not allowed")
		return
	}
	tenant, err := h.Tenant(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}
	_ = tenant // tenant resolution is delegated to the inner handler

	limit := h.BulkLimit
	if limit <= 0 {
		limit = defaultBulkLimit
	}

	var req BulkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalidValue", "invalid JSON")
		return
	}
	if !containsSchema(req.Schemas, BulkRequestSchema) {
		writeError(w, http.StatusBadRequest, "invalidSyntax",
			"schemas must include "+BulkRequestSchema)
		return
	}
	if len(req.Operations) == 0 {
		writeError(w, http.StatusBadRequest, "invalidValue", "Operations required")
		return
	}
	if len(req.Operations) > limit {
		// Go stdlib uses StatusRequestEntityTooLarge for 413; the
		// IETF "Payload Too Large" alias isn't in net/http.
		writeError(w, http.StatusRequestEntityTooLarge, "tooLarge",
			fmt.Sprintf("operations (%d) exceeds bulk limit (%d)", len(req.Operations), limit))
		return
	}

	results := make([]BulkResultOp, 0, len(req.Operations))
	failures := 0
	for _, op := range req.Operations {
		res := h.runBulkOp(r, op)
		results = append(results, res)
		if !isSuccess(res.Status) {
			failures++
			if req.FailOnErrors > 0 && failures >= req.FailOnErrors {
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"schemas":    []string{BulkResponseSchema},
		"Operations": results,
	})
}

// runBulkOp replays one operation against the same mux the public
// handlers use. Reusing the existing routing keeps validation,
// tenant resolution, and ETag handling consistent for free.
func (h *Handler) runBulkOp(parent *http.Request, op BulkOp) BulkResultOp {
	method := strings.ToUpper(op.Method)
	if method == "" || op.Path == "" {
		return BulkResultOp{BulkID: op.BulkID, Method: op.Method, Status: "400"}
	}

	// Route the synthetic request through a fresh mux scoped to the
	// existing handler so we get identical behavior.
	mux := http.NewServeMux()
	h.Register(mux)

	url := h.BasePath + op.Path
	var body io.Reader
	if len(op.Data) > 0 {
		body = bytes.NewReader(op.Data)
	}
	inner, err := http.NewRequestWithContext(parent.Context(), method, url, body)
	if err != nil {
		return BulkResultOp{BulkID: op.BulkID, Method: op.Method, Status: "400"}
	}
	// Copy auth-relevant headers so the TenantResolver works.
	for k, v := range parent.Header {
		if isHopByHop(k) {
			continue
		}
		inner.Header[k] = v
	}
	inner.Header.Set("Content-Type", "application/scim+json")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, inner)

	out := BulkResultOp{
		BulkID: op.BulkID,
		Method: op.Method,
		Status: fmt.Sprintf("%d", rec.Code),
	}
	if rec.Body.Len() > 0 {
		out.Response = json.RawMessage(rec.Body.Bytes())
	}
	if rec.Code == http.StatusCreated {
		if loc := rec.Header().Get("Location"); loc != "" {
			out.Location = loc
		}
	}
	return out
}

func isSuccess(status string) bool {
	return strings.HasPrefix(status, "2")
}

// isHopByHop filters out headers that should not be forwarded to the
// inner sub-request. Authorization is kept so the TenantResolver can
// still resolve the tenant from the bearer token.
func isHopByHop(name string) bool {
	switch strings.ToLower(name) {
	case "connection", "keep-alive", "transfer-encoding",
		"te", "trailer", "upgrade", "proxy-authenticate",
		"proxy-authorization":
		return true
	}
	return false
}

// ErrBulkLimit signals callers that the supplied operation count
// exceeded the configured limit.
var ErrBulkLimit = errors.New("scim: bulk operation count exceeds limit")
