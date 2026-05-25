package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/storage"
)

var validRoles = map[string]bool{
	"admin":  true,
	"member": true,
	"viewer": true,
}

func validRole(r string) bool { return validRoles[r] }

func validEmail(e string) bool {
	at := strings.Index(e, "@")
	if at < 1 {
		return false
	}
	dot := strings.LastIndex(e[at:], ".")
	return dot > 1 && dot < len(e[at:])-1
}

// ListTeamMembers handles GET /api/v1/team/members
func (h *Handlers) ListTeamMembers(w http.ResponseWriter, r *http.Request) {
	members, err := h.db.ListMembers()
	if err != nil {
		jsonError(w, "failed to list members", http.StatusInternalServerError)
		return
	}
	if members == nil {
		members = []storage.TeamMemberRow{}
	}
	jsonOK(w, map[string]interface{}{"members": members, "count": len(members)})
}

// InviteTeamMember handles POST /api/v1/team/members
func (h *Handlers) InviteTeamMember(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if !validEmail(req.Email) {
		jsonError(w, "invalid email address", http.StatusBadRequest)
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if !validRole(req.Role) {
		jsonError(w, "role must be admin, member, or viewer", http.StatusBadRequest)
		return
	}
	if err := h.db.InviteMember(req.Email, req.Role); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(err.Error(), "unique") {
			jsonError(w, "member already exists", http.StatusConflict)
			return
		}
		jsonError(w, "failed to invite member", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"email": req.Email, "role": req.Role, "status": "invited"})
}

// RemoveTeamMember handles DELETE /api/v1/team/members/{email}
func (h *Handlers) RemoveTeamMember(w http.ResponseWriter, r *http.Request) {
	email := strings.TrimPrefix(r.URL.Path, "/api/v1/team/members/")
	email = strings.Split(email, "/")[0]
	if email == "" {
		jsonError(w, "email required", http.StatusBadRequest)
		return
	}
	if err := h.db.RemoveMember(email); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"email": email, "status": "removed"})
}

// UpdateTeamMemberRole handles PUT /api/v1/team/members/{email}/role
func (h *Handlers) UpdateTeamMemberRole(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/team/members/")
	parts := strings.SplitN(path, "/", 2)
	email := parts[0]
	if email == "" {
		jsonError(w, "email required", http.StatusBadRequest)
		return
	}
	var req struct {
		Role string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if !validRole(req.Role) {
		jsonError(w, "role must be admin, member, or viewer", http.StatusBadRequest)
		return
	}
	if err := h.db.UpdateRole(email, req.Role); err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]string{"email": email, "role": req.Role})
}
