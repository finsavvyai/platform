package main

import (
	"net/url"
	"os/exec"
	"runtime"
)

// openBrowser opens the given URL in the user's default browser.
// Best-effort — if the platform isn't supported or the command
// fails, the user sees the URL in the terminal and can paste
// into their browser manually.
func openBrowser(rawURL string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", rawURL)
	case "linux":
		cmd = exec.Command("xdg-open", rawURL)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", rawURL)
	}
	if cmd != nil {
		_ = cmd.Start()
	}
}

// loginURLForArgs builds the browser URL for `pushci login`.
// Supports --tenant <name> for SAML SSO logins:
//
//	pushci login                → app.pushci.dev/cli-auth
//	pushci login --tenant acme  → app.pushci.dev/cli-auth?tenant=acme
//
// The dashboard's cli-auth page reads the tenant query param and
// redirects to api.pushci.dev/saml/<tenant>/login, which kicks off
// the IdP flow. After the IdP posts back to ACS, the dashboard
// displays the JWT for the user to paste into their terminal.
func loginURLForArgs(args []string) string {
	base := "https://app.pushci.dev/cli-auth"
	tenant := flagValue(args, "--tenant")
	if tenant == "" {
		return base
	}
	q := url.Values{}
	q.Set("tenant", tenant)
	return base + "?" + q.Encode()
}
