package main

// Marketplace ref validators — defence against M-001. Mirrors
// api/src/marketplace-action-validate.ts exactly.
import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

var (
	ownerRE      = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`)
	repoRE       = regexp.MustCompile(`^[A-Za-z0-9_.\-]{1,100}$`)
	refRE        = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.\-]{0,99}$`)
	subpathSegRE = regexp.MustCompile(`^[A-Za-z0-9_.\-]{1,100}$`)
	encodedBadRE = regexp.MustCompile(`(?i)%(?:2e|2f|5c|00|0a|0d)`)
	dotsOnlyRE   = regexp.MustCompile(`^\.+$`)
)

func validateOwner(s string) bool {
	return s != "." && s != ".." && ownerRE.MatchString(s)
}

func validateRepo(s string) bool {
	return repoRE.MatchString(s) && !dotsOnlyRE.MatchString(s)
}

func validateRef(s string) bool {
	return refRE.MatchString(s) && !strings.Contains(s, "..") && !encodedBadRE.MatchString(s)
}

func validateSubpath(s string) bool {
	if s == "" {
		return true
	}
	if strings.HasPrefix(s, "/") || strings.HasSuffix(s, "/") || strings.Contains(s, "//") {
		return false
	}
	if encodedBadRE.MatchString(s) {
		return false
	}
	for _, seg := range strings.Split(s, "/") {
		if seg == "." || seg == ".." || !subpathSegRE.MatchString(seg) {
			return false
		}
	}
	return true
}

func validateMarketplaceRef(r marketplaceRef) bool {
	return validateOwner(r.owner) && validateRepo(r.repo) &&
		validateRef(r.version) && validateSubpath(r.subpath)
}

// canonicalRawURL mirrors the TS implementation: rejects traversal
// segments in the raw string (url.Parse would collapse them), then
// re-verifies host / scheme / no query-or-fragment.
func canonicalRawURL(raw string) (string, bool) {
	if strings.ContainsAny(raw, " \t\n\r") || encodedBadRE.MatchString(raw) {
		return "", false
	}
	if i := strings.Index(raw, "://"); i >= 0 {
		afterScheme := raw[i+3:]
		slash := strings.Index(afterScheme, "/")
		if slash < 0 {
			return "", false
		}
		p := afterScheme[slash:]
		if strings.Contains(p, "//") || strings.Contains(p, "/../") ||
			strings.Contains(p, "/./") || strings.HasSuffix(p, "/..") ||
			strings.HasSuffix(p, "/.") {
			return "", false
		}
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host != "raw.githubusercontent.com" {
		return "", false
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "", false
	}
	return fmt.Sprintf("https://%s%s", u.Host, u.Path), true
}

func marketplaceCacheKey(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}
