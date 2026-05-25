// Package main is the public PipeWarden CLI: scan, dlp, trace, and
// test-provider subcommands. The hosted SaaS server lives in a
// separate binary (cmd/pipewarden-server) so the open-core OSS
// surface does not depend on hosted handlers, billing, auth, or any
// of the SaaS-only packages.
//
// Run without arguments to print usage. Run `pipewarden <subcommand>
// --help` for per-subcommand flags.
package main

import (
	"fmt"
	"os"
)

var (
	version = "dev"
	commit  = "unknown"
	date    = "unknown"
)

const usage = `pipewarden — CI/CD pipeline security CLI

Usage:
  pipewarden <subcommand> [flags]

Subcommands:
  scan           Scan a path or staged diff for security findings
  dlp            Run the DLP secret-pattern scanner standalone
  trace          Capture or query runtime traces from a running server
  test-provider  Verify connectivity to a configured CI/CD provider
  vault-rotate   Re-encrypt stored credentials with a new master key
  --version      Print version information and exit

For a hosted dashboard, REST API, OAuth, billing, and team management,
run the separate ` + "`pipewarden-server`" + ` binary.

Examples:
  pipewarden scan .
  pipewarden dlp ./internal/...
  pipewarden test-provider github
  pipewarden trace --format=pretty
`

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "scan":
			handleScanSubcommand(os.Args[2:])
			return
		case "dlp":
			handleDLPSubcommand(os.Args[2:])
			return
		case "trace":
			handleTraceSubcommand(os.Args[2:])
			return
		case "test-provider":
			handleTestProviderSubcommand(os.Args[2:])
			return
		case "vault-rotate":
			os.Exit(handleVaultRotateSubcommand(os.Args[2:]))
		case "--version", "-v", "version":
			fmt.Printf("pipewarden version=%s commit=%s date=%s\n", version, commit, date)
			return
		case "--help", "-h", "help":
			fmt.Print(usage)
			return
		}
	}
	fmt.Print(usage)
	os.Exit(1)
}
