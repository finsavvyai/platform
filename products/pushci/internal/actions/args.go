package actions

import (
	"os"
)

// buildArgs translates RunOptions into the canonical act argv. The
// returned cleanup function MUST be called once the command finishes
// — it removes any temp secret/env files we materialized.
func buildArgs(opts RunOptions) ([]string, func(), error) {
	args := buildBaseArgs(opts)
	args = appendArchitecture(args, opts)
	args = appendEventPayload(args, opts)
	args = appendMatrixAndInputs(args, opts)
	args = appendPlatforms(args, opts)
	args = appendLocalRepositories(args, opts)

	cleanups := []func(){}
	addCleanup := func(path string) {
		if path == "" {
			return
		}
		cleanups = append(cleanups, func() { _ = os.Remove(path) })
	}
	cleanup := func() { runAll(cleanups) }

	secretFile, err := writeSecretsFile(mergedSecretsForToken(opts))
	if err != nil {
		cleanup()
		return nil, func() {}, err
	}
	addCleanup(secretFile)
	if secretFile != "" {
		args = append(args, "--secret-file", secretFile)
	}

	envFile, err := writeEnvFile(opts.Env)
	if err != nil {
		cleanup()
		return nil, func() {}, err
	}
	addCleanup(envFile)
	if envFile != "" {
		args = append(args, "--env-file", envFile)
	}

	return args, cleanup, nil
}

// buildBaseArgs handles the simple positional and boolean flags. Split
// out so the top-level buildArgs stays under the file's complexity cap.
func buildBaseArgs(opts RunOptions) []string {
	args := []string{}
	if opts.Event != "" {
		args = append(args, opts.Event)
	}
	if opts.WorkflowsDir != "" {
		args = append(args, "--workflows", opts.WorkflowsDir)
	}
	if opts.Job != "" {
		args = append(args, "-j", opts.Job)
	}
	if opts.DryRun {
		args = append(args, "--dryrun")
	}
	if opts.Verbose {
		args = append(args, "--verbose")
	}
	if opts.Bind {
		args = append(args, "--bind")
	}
	if opts.JSONLogs {
		args = append(args, "--json")
	}
	if opts.Reuse {
		args = append(args, "--reuse")
	}
	return args
}

// appendArchitecture, appendEventPayload, appendMatrixAndInputs,
// appendPlatforms, sortedKeys, and runAll live in args_helpers.go.
