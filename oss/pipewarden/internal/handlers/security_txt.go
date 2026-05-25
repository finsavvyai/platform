package handlers

import (
	"fmt"
	"net/http"
	"time"
)

// SecurityTxt serves /.well-known/security.txt — RFC 9116 responsible-
// disclosure document. Search engines and security researchers check
// this path first. Static template; expiry is recomputed each request
// so the file never serves a date in the past.
func (h *Handlers) SecurityTxt(w http.ResponseWriter, r *http.Request) {
	expires := time.Now().UTC().Add(365 * 24 * time.Hour).Format(time.RFC3339)
	body := fmt.Sprintf(`Contact: mailto:security@pipewarden.io
Contact: https://github.com/finsavvyai/pipewarden/security/advisories/new
Expires: %s
Encryption: https://pipewarden.io/.well-known/pgp-key.txt
Acknowledgments: https://pipewarden.io/security/hall-of-fame
Preferred-Languages: en
Canonical: https://pipewarden.io/.well-known/security.txt
Policy: https://pipewarden.io/security/policy
Hiring: https://pipewarden.io/jobs
`, expires)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write([]byte(body))
}
