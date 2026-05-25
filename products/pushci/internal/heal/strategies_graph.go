package heal

import "strings"

// graphAPI401 detects Microsoft Graph API 401 errors and suggests
// token refresh or re-authentication.
func graphAPI401(output string) *Fix {
	if !strings.Contains(output, "401") {
		return nil
	}
	if !strings.Contains(output, "graph.microsoft.com") &&
		!strings.Contains(output, "Graph API") &&
		!strings.Contains(output, "InvalidAuthenticationToken") {
		return nil
	}
	return &Fix{
		Pattern: "graph-api-401",
		Action:  "echo 'Graph API 401 — refresh token from KV or re-authenticate tenant'",
	}
}

// graphAPIThrottle detects Graph API 429 throttling responses.
func graphAPIThrottle(output string) *Fix {
	if !strings.Contains(output, "429") {
		return nil
	}
	if !strings.Contains(output, "graph.microsoft.com") &&
		!strings.Contains(output, "throttled") &&
		!strings.Contains(output, "Retry-After") {
		return nil
	}
	return &Fix{
		Pattern: "graph-api-throttle",
		Action:  "echo 'Graph API throttled — implement exponential backoff'",
	}
}

// graphTokenExpired detects expired token patterns.
func graphTokenExpired(output string) *Fix {
	if !strings.Contains(output, "token has expired") &&
		!strings.Contains(output, "AADSTS700024") &&
		!strings.Contains(output, "TokenExpired") {
		return nil
	}
	return &Fix{
		Pattern: "graph-token-expired",
		Action:  "echo 'Graph token expired — trigger token refresh via /api/auth/refresh'",
	}
}

// graphStrategies returns all Graph API heal strategies.
func graphStrategies() []strategy {
	return []strategy{
		graphAPI401,
		graphAPIThrottle,
		graphTokenExpired,
	}
}
