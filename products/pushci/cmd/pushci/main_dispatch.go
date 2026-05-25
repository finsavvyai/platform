package main

import (
	"context"
	"fmt"
	"os"

	"github.com/finsavvyai/pushci/internal/cli"
)

// dispatch routes a CLI command to its handler. Returns (error, handled).
// Returns handled=false for built-in non-error commands (version, help).
func dispatch(ctx context.Context, cmd string, args []string) (error, bool) {
	switch cmd {
	case "init":
		return cmdInit(ctx), true
	case "run":
		return cmdRun(ctx, args), true
	case "deploy":
		return cmdDeploy(ctx, args), true
	case "diagnose":
		return cmdDiagnose(ctx), true
	case "extend":
		return cmdExtend(ctx), true
	case "status":
		return cmdStatus(), true
	case "secret", "secrets":
		return cmdSecret(args), true
	case "scan":
		return cmdScan(args), true
	case "actions":
		return cmdActions(ctx, args), true
	case "trigger":
		return cmdTrigger(ctx, args), true
	case "heal":
		return cmdHeal(ctx), true
	case "ask":
		return cmdAsk(ctx, args), true
	case "generate":
		return cmdGenerate(ctx), true
	case "migrate":
		return cmdMigrate(args), true
	case "import":
		return cmdImport(ctx, args), true
	case "import-from-actions":
		return cmdImportActions(ctx, args), true
	case "mcp":
		return cmdMCP(), true
	case "agent":
		return cmdAgent(), true
	case "index":
		return cmdIndex(args), true
	case "intel":
		return cmdIntel(args), true
	case "skill":
		return cmdSkill(args), true
	case "login":
		return cmdLogin(), true
	case "logout":
		return cmdLogout(), true
	case "doctor":
		return cmdDoctor(), true
	case "troubleshoot", "ts":
		return cmdTroubleshoot(args), true
	case "trace":
		return cmdTrace(args), true
	case "release":
		return cmdRelease(ctx, args), true
	case "promote":
		return cmdPromote(), true
	case "install-hooks":
		return cmdInstallHooks(args), true
	case "uninstall":
		return cmdUninstall(), true
	case "voice":
		return cmdVoice(ctx, args), true
	case "version", "--version", "-v":
		fmt.Printf("pushci %s\n", version)
		return nil, false
	case "help", "--help", "-h":
		printUsage()
		return nil, false
	default:
		cli.Error(fmt.Sprintf("unknown command: %s", cmd))
		printUsage()
		os.Exit(1)
		return nil, false
	}
}
