// Domain verification HTTP handlers.
// POST /api/v1/domains          — register a domain and receive a token
// POST /api/v1/domains/{domain}/verify — trigger verification
// GET  /api/v1/domains          — list tenant's domains
// DELETE /api/v1/domains/{domain} — remove a domain record

package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	dv "github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/domain_verification"
)

// auditFromDeps returns the AuditAppender from Dependencies, nil-safe.
func auditFromDeps(deps *Dependencies) AuditAppender {
	if deps == nil {
		return nil
	}
	return deps.Audit
}

// fallbackDomainStore is used when Dependencies.DomainStore is nil
// (dev/no-DB). Production passes a *dv.PgxStore via Dependencies.
var fallbackDomainStore dv.Store = dv.NewMemStore()

// domainStoreFromDeps returns the store wired on the dependencies, or
// the in-process MemStore fallback when the caller didn't supply one.
func domainStoreFromDeps(deps *Dependencies) dv.Store {
	if deps != nil && deps.DomainStore != nil {
		return deps.DomainStore
	}
	return fallbackDomainStore
}

// domainVerifier is the shared Verifier used by the handler.
var domainVerifier = dv.NewVerifier()

// RegisterDomain handles POST /api/v1/domains.
func RegisterDomain(deps *Dependencies) http.HandlerFunc {
	store := domainStoreFromDeps(deps)
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Domain string `json:"domain"`
			Method string `json:"method"` // "dns" or "http"
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Domain == "" {
			http.Error(w, "domain and method required", http.StatusBadRequest)
			return
		}
		method := dv.VerifyMethod(body.Method)
		if method != dv.MethodDNS && method != dv.MethodHTTP {
			http.Error(w, "method must be 'dns' or 'http'", http.StatusBadRequest)
			return
		}
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			http.Error(w, "tenant context missing", http.StatusUnauthorized)
			return
		}
		token := generateToken()
		rec := dv.DomainRecord{
			ID:        uuid.New(),
			TenantID:  tenantID,
			Domain:    body.Domain,
			Token:     dv.Token(token),
			Method:    method,
			Status:    dv.StatusPending,
			CreatedAt: time.Now(),
		}
		if err := store.Save(r.Context(), rec); err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if a := auditFromDeps(deps); a != nil {
			if err := a.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				TenantID:  tenantID,
				Action:    "domain.register",
				Target:    "domains/" + rec.Domain,
				After:     map[string]any{"domain": rec.Domain, "method": string(method)},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				http.Error(w, "audit write failed: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"domain": rec.Domain,
			"token":  token,
			"method": string(method),
			"status": string(rec.Status),
		})
	}
}

// VerifyDomain handles POST /api/v1/domains/{domain}/verify.
func VerifyDomain(deps *Dependencies) http.HandlerFunc {
	store := domainStoreFromDeps(deps)
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			http.Error(w, "tenant context missing", http.StatusUnauthorized)
			return
		}
		domain := chi.URLParam(r, "domain")
		rec, err := store.Get(r.Context(), tenantID, domain)
		if errors.Is(err, dv.ErrNotFound) {
			http.Error(w, "domain not registered", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if err := domainVerifier.Verify(r.Context(), rec.Method, domain, rec.Token); err != nil {
			http.Error(w, "verification failed: "+err.Error(), http.StatusBadRequest)
			return
		}
		now := time.Now()
		expires := now.Add(domainVerifier.Window)
		rec.Status = dv.StatusVerified
		rec.VerifiedAt = &now
		rec.ExpiresAt = &expires
		_ = store.Save(r.Context(), rec)
		if a := auditFromDeps(deps); a != nil {
			if err := a.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				TenantID:  tenantID,
				Action:    "domain.verify",
				Target:    "domains/" + domain,
				After:     map[string]any{"domain": domain, "status": string(rec.Status)},
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				http.Error(w, "audit write failed: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"domain": domain,
			"status": string(rec.Status),
		})
	}
}

// ListDomains handles GET /api/v1/domains.
func ListDomains(deps *Dependencies) http.HandlerFunc {
	store := domainStoreFromDeps(deps)
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			http.Error(w, "tenant context missing", http.StatusUnauthorized)
			return
		}
		rows, err := store.List(r.Context(), tenantID)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		type row struct {
			Domain     string  `json:"domain"`
			Method     string  `json:"method"`
			Status     string  `json:"status"`
			VerifiedAt *string `json:"verified_at,omitempty"`
			ExpiresAt  *string `json:"expires_at,omitempty"`
		}
		out := make([]row, 0, len(rows))
		for _, rec := range rows {
			r2 := row{Domain: rec.Domain, Method: string(rec.Method), Status: string(rec.Status)}
			if rec.VerifiedAt != nil {
				s := rec.VerifiedAt.Format(time.RFC3339)
				r2.VerifiedAt = &s
			}
			if rec.ExpiresAt != nil {
				s := rec.ExpiresAt.Format(time.RFC3339)
				r2.ExpiresAt = &s
			}
			out = append(out, r2)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	}
}

// DeleteDomain handles DELETE /api/v1/domains/{domain}.
func DeleteDomain(deps *Dependencies) http.HandlerFunc {
	store := domainStoreFromDeps(deps)
	return func(w http.ResponseWriter, r *http.Request) {
		tenantID, ok := tenantFromCtx(r.Context())
		if !ok {
			http.Error(w, "tenant context missing", http.StatusUnauthorized)
			return
		}
		domain := chi.URLParam(r, "domain")
		if err := store.Delete(r.Context(), tenantID, domain); err != nil && !errors.Is(err, dv.ErrNotFound) {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if a := auditFromDeps(deps); a != nil {
			if err := a.Append(r.Context(), AuditEvent{
				ActorID:   actorIDFromCtx(r),
				TenantID:  tenantID,
				Action:    "domain.delete",
				Target:    "domains/" + domain,
				IP:        r.RemoteAddr,
				UserAgent: r.UserAgent(),
				Timestamp: time.Now(),
			}); err != nil {
				http.Error(w, "audit write failed: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
