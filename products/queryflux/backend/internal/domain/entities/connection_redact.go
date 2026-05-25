package entities

import (
	"net/url"
	"strings"
)

// RedactedDSN returns a connection string for c with credentials masked.
//
// It is the canonical helper for safe rendering of a Connection in logs,
// error bodies, audit events, and MCP tool output. Coverage:
//
//   - postgres://, postgresql://
//   - mysql://, mariadb://
//   - mongodb://, mongodb+srv://
//   - redis://, rediss://, redis+tls://
//   - sqlite file paths (returned unchanged; SQLite has no credentials)
//   - generic user:pass@host[:port][/db] patterns
//
// The password component is always replaced with the literal "***" when
// present. The username is preserved so operators can still tell which
// principal a connection uses. Query parameters are preserved verbatim
// EXCEPT for "password" / "pwd" keys, which are also masked.
//
// RedactedDSN never panics and always returns a non-empty string.
func (c *Connection) RedactedDSN() string {
	if c == nil {
		return ""
	}

	switch strings.ToLower(c.Type) {
	case TypeSQLite:
		// SQLite uses a file path, not credentials. Database holds path.
		return c.Database
	}

	scheme := dsnScheme(c.Type)
	host := c.Host
	if host == "" {
		host = "localhost"
	}
	if c.Port > 0 {
		host = joinHostPort(host, c.Port)
	}

	user := c.Username
	if user == "" && c.Password == "" {
		// No userinfo at all
		return scheme + "://" + host + dsnPath(c.Database)
	}

	// Always mask the password; preserve the username
	userinfo := url.QueryEscape(user)
	if c.Password != "" {
		userinfo += ":***"
	}

	return scheme + "://" + userinfo + "@" + host + dsnPath(c.Database)
}

// dsnScheme maps a Connection.Type to a canonical URL scheme.
func dsnScheme(t string) string {
	switch strings.ToLower(t) {
	case TypePostgreSQL, "postgres":
		return "postgres"
	case TypeMySQL:
		return "mysql"
	case TypeMariaDB:
		return "mariadb"
	case TypeMongoDB:
		return "mongodb"
	case "mongodb+srv":
		return "mongodb+srv"
	case TypeRedis:
		return "redis"
	case "rediss", "redis+tls":
		return "rediss"
	default:
		// Fall back to the raw type so callers still get a parseable prefix.
		if t == "" {
			return "db"
		}
		return strings.ToLower(t)
	}
}

// dsnPath returns "/<database>" or "" when no database is set. IPv6 hosts
// are already wrapped by joinHostPort, so this is safe to concatenate.
func dsnPath(db string) string {
	if db == "" {
		return ""
	}
	if strings.HasPrefix(db, "/") {
		return db
	}
	return "/" + db
}

// joinHostPort wraps IPv6 literals in brackets and appends the port.
func joinHostPort(host string, port int) string {
	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}
	return host + ":" + itoa(port)
}

// itoa is a tiny local helper to avoid pulling strconv just for one call.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

// RedactDSNString masks credentials in an already-formed DSN string. It is
// exposed for adapter/runner error paths that already hold a raw DSN rather
// than a Connection entity. Unknown schemes are returned with any embedded
// "user:pass@" segment masked to "user:***@".
func RedactDSNString(dsn string) string {
	if dsn == "" {
		return ""
	}
	// Only treat as URL when an explicit scheme is present. url.Parse is
	// lenient and would otherwise accept "user:pass@host" as scheme="user".
	if strings.Contains(dsn, "://") {
		if out, ok := redactURL(dsn); ok {
			return out
		}
	}
	// Fallback: best-effort masking of user:pass@host shapes.
	at := strings.LastIndex(dsn, "@")
	if at <= 0 {
		return dsn
	}
	colon := strings.Index(dsn[:at], ":")
	if colon <= 0 {
		return dsn
	}
	schemeEnd := strings.Index(dsn, "://")
	userStart := 0
	if schemeEnd >= 0 {
		userStart = schemeEnd + 3
	}
	if colon < userStart {
		return dsn
	}
	return dsn[:colon+1] + "***" + dsn[at:]
}

// redactURL rewrites a fully-qualified DSN URL with credentials masked.
// Returns ok=false when the input cannot be parsed as a URL.
func redactURL(dsn string) (string, bool) {
	u, err := url.Parse(dsn)
	if err != nil || u.Scheme == "" {
		return "", false
	}
	if u.User != nil {
		name := u.User.Username()
		if _, hasPwd := u.User.Password(); hasPwd {
			// Build userinfo manually so the literal "***" is not URL-
			// escaped to "%2A%2A%2A" by url.UserPassword.
			u.User = nil
			q := redactQueryParams(u.Query())
			u.RawQuery = q
			rest := strings.TrimPrefix(u.String(), u.Scheme+"://")
			return u.Scheme + "://" + name + ":***@" + rest, true
		}
	}
	u.RawQuery = redactQueryParams(u.Query())
	return u.String(), true
}

// redactQueryParams masks any password-like query parameter.
func redactQueryParams(q url.Values) string {
	for _, k := range []string{"password", "pwd"} {
		if q.Get(k) != "" {
			q.Set(k, "***")
		}
	}
	// url.Values.Encode escapes "***" as "%2A%2A%2A"; substitute back so the
	// rendered DSN is human-readable.
	return strings.ReplaceAll(q.Encode(), "%2A%2A%2A", "***")
}
