package api

import "net/http"

// hasProduct checks if the current tenant has a specific product enabled.
// Falls back to true if tenant config can't be loaded (fail-open for dev).
func hasProduct(r *http.Request, product string) bool {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return false
	}
	// Admin users bypass product gates
	if claims.Role == "admin" || claims.Role == "superadmin" {
		return true
	}
	// Check tenant's enabled products
	for _, p := range claims.Products {
		if p == product {
			return true
		}
	}
	return false
}
