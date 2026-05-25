package api

import "net/http"

// actorFromRequest extracts the actor identity from JWT claims.
func actorFromRequest(r *http.Request) string {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return "unknown"
	}
	return claims.UserID
}
