// Package handlers — REST handlers for shared projects (Day 53).
// Routes: GET/POST /v1/projects, GET/PUT/DELETE /v1/projects/{id},
// POST /v1/projects/{id}/members. tenantID + userID come from ctx.
package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	appmw "github.com/sdlc-ai/platform/services/gateway/internal/app/middleware"
	"github.com/sdlc-ai/platform/services/gateway/internal/domain/projects"
)

// CtxKey is the typed context key namespace for handlers.
type ctxKey string

const (
	ctxTenantID ctxKey = "tenant_id"
	ctxUserID   ctxKey = "user_id"
)

// ProjectsDeps wires the handler to its service. The TenantFrom /
// UserFrom funcs default to the typed ctx keys; auth middleware can
// inject custom extractors. RBAC is optional; nil disables permission
// checks (dev / single-tenant deployments).
type ProjectsDeps struct {
	Service    *projects.Service
	TenantFrom func(*http.Request) (uuid.UUID, error)
	UserFrom   func(*http.Request) (uuid.UUID, error)
	RBAC       *appmw.RBAC
}

// gate returns RequirePermission middleware when RBAC is configured,
// otherwise a passthrough. Keeps each route declaration a single line.
func (d ProjectsDeps) gate(perm string) func(http.Handler) http.Handler {
	if d.RBAC == nil {
		return func(next http.Handler) http.Handler { return next }
	}
	return d.RBAC.RequirePermission(perm)
}

// MountProjects registers the project routes on r.
func MountProjects(r chi.Router, deps ProjectsDeps) {
	if deps.TenantFrom == nil {
		deps.TenantFrom = defaultUUIDFromCtx(ctxTenantID)
	}
	if deps.UserFrom == nil {
		deps.UserFrom = defaultUUIDFromCtx(ctxUserID)
	}
	r.Route("/v1/projects", func(r chi.Router) {
		r.With(deps.gate("projects:read")).Get("/", listProjects(deps))
		r.With(deps.gate("projects:write")).Post("/", createProject(deps))
		r.With(deps.gate("projects:read")).Get("/{id}", getProject(deps))
		r.With(deps.gate("projects:write")).Put("/{id}", updateProject(deps))
		r.With(deps.gate("projects:delete")).Delete("/{id}", deleteProject(deps))
		r.With(deps.gate("projects:write")).Post("/{id}/members", addMember(deps))
		r.With(deps.gate("projects:write")).Delete("/{id}/members/{user_id}", removeMember(deps))
	})
}

func defaultUUIDFromCtx(k ctxKey) func(*http.Request) (uuid.UUID, error) {
	return func(r *http.Request) (uuid.UUID, error) {
		v, ok := r.Context().Value(k).(uuid.UUID)
		if !ok {
			return uuid.Nil, errors.New("missing context value: " + string(k))
		}
		return v, nil
	}
}

func listProjects(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		out, err := d.Service.List(r.Context(), tenant)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"projects": out})
	}
}

func createProject(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		user, err := d.UserFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		var in projects.CreateInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		p, err := d.Service.Create(r.Context(), tenant, user, in)
		if err != nil {
			statusFor(err, w)
			return
		}
		writeJSON(w, http.StatusCreated, p)
	}
}

func getProject(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		p, err := d.Service.Get(r.Context(), tenant, id)
		if err != nil {
			statusFor(err, w)
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func updateProject(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		var in projects.UpdateInput
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		p, err := d.Service.Update(r.Context(), tenant, id, in)
		if err != nil {
			statusFor(err, w)
			return
		}
		writeJSON(w, http.StatusOK, p)
	}
}

func deleteProject(d ProjectsDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tenant, err := d.TenantFrom(r)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, err)
			return
		}
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		if err := d.Service.Delete(r.Context(), tenant, id); err != nil {
			statusFor(err, w)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}


