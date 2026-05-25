// MFA verify handler. POST /v1/auth/mfa/verify.
//
// Body: {"code":"123456"}. The code is checked against the user's
// stored TOTP secret with a ±1-window tolerance (sso.VerifyTOTP). On
// success we stamp the MFAStore so EnsureFreshMFA passes for the next
// MFAFreshness window. Pairs with the MFAGate middleware.
package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/sdlc-ai/platform/services/gateway/internal/domain/repositories"
	"github.com/sdlc-ai/platform/services/gateway/internal/infrastructure/sso"
)

// MFAVerifyDeps wires the handler. UserRepo loads the encrypted TOTP
// secret. Decryptor optionally unwraps it (production wires the CMEK
// envelope; tests can pass a passthrough that returns input unchanged).
// Store is the same MFAStore the middleware reads.
type MFAVerifyDeps struct {
	Store      sso.MFAStore
	UserRepo   repositories.UserRepository
	Decryptor  func(ciphertext []byte) ([]byte, error)
	UserFromCtx func(r *http.Request) uuid.UUID
}

// MFAVerifyRequest is the JSON body shape.
type MFAVerifyRequest struct {
	Code string `json:"code"`
}

// MFAVerify returns the http.HandlerFunc.
func MFAVerify(deps MFAVerifyDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reqID := uuid.New().String()
		uid := deps.UserFromCtx(r)
		if uid == uuid.Nil {
			respondWithError(w, http.StatusUnauthorized, "UNAUTHORIZED", "no user context", reqID)
			return
		}
		var req MFAVerifyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Code == "" {
			respondWithError(w, http.StatusBadRequest, "VALIDATION_ERROR", "code is required", reqID)
			return
		}

		user, err := deps.UserRepo.GetByID(r.Context(), uid)
		if err != nil || user == nil {
			respondWithError(w, http.StatusNotFound, "NOT_FOUND", "user not found", reqID)
			return
		}
		if len(user.MFASecret) == 0 {
			respondWithError(w, http.StatusPreconditionFailed, "MFA_NOT_ENROLLED", "user has not enrolled MFA", reqID)
			return
		}

		secret, err := decryptOrPass(deps.Decryptor, user.MFASecret)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "secret decrypt failed", reqID)
			return
		}
		// secret is stored as base32-encoded bytes; VerifyTOTP wants a
		// base32 string.
		secretB32 := string(secret)
		// Some stores write the raw 20-byte secret rather than the
		// base32 form; encode if it doesn't decode cleanly.
		if _, decErr := base64.StdEncoding.DecodeString(secretB32); decErr != nil && !looksBase32(secretB32) {
			secretB32 = base32Encode(secret)
		}

		ok, err := sso.VerifyTOTP(secretB32, req.Code, time.Now())
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), reqID)
			return
		}
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "INVALID_CODE", "TOTP code did not match", reqID)
			return
		}
		if err := deps.Store.StampMFA(r.Context(), uid); err != nil {
			respondWithError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "stamp failed", reqID)
			return
		}
		renderJSON(w, http.StatusOK, map[string]any{
			"data": map[string]any{"verified": true},
			"meta": map[string]any{"request_id": reqID},
		})
	}
}

func decryptOrPass(dec func([]byte) ([]byte, error), in []byte) ([]byte, error) {
	if dec == nil {
		return in, nil
	}
	out, err := dec(in)
	if err != nil {
		// Treat decrypt error as fatal — secret is unusable.
		return nil, errors.New("mfa: decrypt failed")
	}
	return out, nil
}

// looksBase32 returns true when s is plausibly RFC 4648 base32. Used
// to distinguish "secret stored as base32 string" vs "secret stored as
// raw bytes" so we encode appropriately for VerifyTOTP.
func looksBase32(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'A' && r <= 'Z':
		case r >= '2' && r <= '7':
		case r == '=':
		default:
			return false
		}
	}
	return true
}

// base32Encode emits the canonical RFC 4648 base32 (no padding) for a
// raw-bytes secret. Inline to avoid an extra import alias.
func base32Encode(b []byte) string {
	const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
	out := make([]byte, 0, ((len(b)*8)+4)/5)
	var buf uint64
	bits := 0
	for _, c := range b {
		buf = (buf << 8) | uint64(c)
		bits += 8
		for bits >= 5 {
			bits -= 5
			out = append(out, alphabet[(buf>>uint(bits))&0x1F])
		}
	}
	if bits > 0 {
		out = append(out, alphabet[(buf<<uint(5-bits))&0x1F])
	}
	return string(out)
}
