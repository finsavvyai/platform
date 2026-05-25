package api

import (
	"database/sql"
	"net/http"

	"github.com/aegis-aml/aegis/internal/email"
	"github.com/aegis-aml/aegis/internal/storage"
)

// ResetHandler manages the password reset flow (request + execute).
type ResetHandler struct {
	db     *sql.DB
	users  storage.UserRepository
	mailer email.Sender
	secret string
}

// NewResetHandler wires the reset flow with its dependencies.
func NewResetHandler(
	db *sql.DB, users storage.UserRepository, secret string,
) *ResetHandler {
	return &ResetHandler{
		db: db, users: users,
		mailer: email.NewSender(), secret: secret,
	}
}

// RequestReset generates a reset token, persists its SHA-256 hash,
// and emails the raw token to the user. The response intentionally
// does not reveal whether the email exists — it always returns the
// same "check your inbox" message.
func (h *ResetHandler) RequestReset(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := DecodeJSON(r, &req); err != nil || req.Email == "" {
		Error(w, "VALIDATION", "email required", http.StatusBadRequest)
		return
	}

	user, err := h.users.GetByEmail(r.Context(), req.Email)
	if err != nil || user == nil {
		respondResetOK(w)
		return
	}
	if err := h.issueResetToken(r, req.Email, user.ID); err != nil {
		Error(w, "DB_ERROR", "internal error", http.StatusInternalServerError)
		return
	}
	respondResetOK(w)
}

func respondResetOK(w http.ResponseWriter) {
	Success(w, map[string]string{
		"message": "If that email exists, a reset link has been sent.",
	}, http.StatusOK)
}
