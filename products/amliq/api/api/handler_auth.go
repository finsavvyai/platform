package api

import (
	"encoding/json"
	"net/http"

	"github.com/aegis-aml/aegis/internal/email"
	"github.com/aegis-aml/aegis/internal/storage"
)

type AuthHandler struct {
	users        storage.UserRepository
	tenants      storage.TenantRepository
	secret       string
	expiry       int
	emailSender  email.Sender
}

func NewAuthHandler(users storage.UserRepository, tenants storage.TenantRepository, secret string, expiry int) *AuthHandler {
	return &AuthHandler{
		users:       users,
		tenants:     tenants,
		secret:      secret,
		expiry:      expiry,
		emailSender: email.NewSender(),
	}
}

// WithEmailSender attaches a transactional email sender used for
// welcome mails on signup. Returns the receiver for chaining.
func (h *AuthHandler) WithEmailSender(s email.Sender) *AuthHandler {
	h.emailSender = s
	return h
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_BODY", "invalid request body", http.StatusBadRequest)
		return
	}
	user, err := h.users.GetByEmail(r.Context(), req.Email)
	if err != nil || user == nil {
		Error(w, "INVALID_CREDENTIALS", "invalid email or password", http.StatusUnauthorized)
		return
	}
	if !checkPassword(req.Password, user.Password) {
		Error(w, "INVALID_CREDENTIALS", "invalid email or password", http.StatusUnauthorized)
		return
	}
	trackLogin(user.TenantID, user.ID)
	h.respondWithToken(w, user)
}

func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		OrgName  string `json:"org_name"`
		Country  string `json:"country"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		Error(w, "INVALID_BODY", "invalid request body", http.StatusBadRequest)
		return
	}
	tenant, user, err := h.createTenantAndUser(r, req.OrgName, req.Country, req.Email, hashPassword(req.Password))
	if err != nil {
		Error(w, "SIGNUP_FAILED", err.Error(), http.StatusConflict)
		return
	}
	h.sendWelcomeAsync(user.Email, tenant.Name)
	trackSignup(tenant.ID.String(), req.Country)
	h.respondWithToken(w, &user)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		Error(w, "UNAUTHORIZED", "not authenticated", http.StatusUnauthorized)
		return
	}
	user, _ := h.users.GetByID(r.Context(), claims.UserID)
	if user == nil {
		Error(w, "NOT_FOUND", "user not found", http.StatusNotFound)
		return
	}
	Success(w, map[string]string{
		"id": user.ID, "email": user.Email,
		"role": user.Role, "tenant_id": user.TenantID,
	}, http.StatusOK)
}

