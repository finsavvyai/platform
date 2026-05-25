// ETag concurrency helpers. Day 23: per RFC 7644 §3.14 every SCIM
// resource carries a version token; PUT/PATCH that supply an
// `If-Match` header must match the current version or the server
// returns 412 Precondition Failed.
//
// We derive the version from Meta.LastModified rather than a separate
// counter so existing stores that already populate that timestamp get
// concurrency for free. The version string is the RFC 3339 nano
// timestamp wrapped in W/"…" (weak ETag, since timestamp resolution
// is good enough for human-driven retries but not byte-exact).
package scim

import (
	"net/http"
	"strings"
	"time"
)

// etagFor produces the W/"…" weak-validator string for a resource.
// Returns the empty string when the resource has never been written
// (zero LastModified) so callers can still serve fresh creates.
func etagFor(lastModified time.Time) string {
	if lastModified.IsZero() {
		return ""
	}
	return `W/"` + lastModified.UTC().Format(time.RFC3339Nano) + `"`
}

// withETag stamps the User's Meta.Version, sets the ETag response
// header, and returns the user. Use as `writeJSON(w, status,
// withETag(w, u))` so the JSON payload and the header agree.
func withETag(w http.ResponseWriter, u User) User {
	tag := etagFor(u.Meta.LastModified)
	if tag != "" {
		w.Header().Set("ETag", tag)
		u.Meta.Version = tag
	}
	return u
}

// withGroupETag is the Group equivalent of withETag.
func withGroupETag(w http.ResponseWriter, g Group) Group {
	tag := etagFor(g.Meta.LastModified)
	if tag != "" {
		w.Header().Set("ETag", tag)
		g.Meta.Version = tag
	}
	return g
}

// checkIfMatch returns true when the request either:
//   - omits the If-Match header (concurrency is opt-in), OR
//   - sends a header that matches the current LastModified version.
//
// Returns false when If-Match is present and does not match, so the
// caller can return 412 Precondition Failed.
func checkIfMatch(r *http.Request, lastModified time.Time) bool {
	want := strings.TrimSpace(r.Header.Get("If-Match"))
	if want == "" {
		return true
	}
	current := etagFor(lastModified)
	// `*` is a wildcard match per RFC 7232.
	if want == "*" {
		return current != ""
	}
	// Allow comma-separated lists per RFC 7232.
	for _, candidate := range strings.Split(want, ",") {
		if strings.TrimSpace(candidate) == current {
			return true
		}
	}
	return false
}
