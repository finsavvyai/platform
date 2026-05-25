package main

import "time"

func onFinish(start time.Time, voice bool, errPtr *error) {
	if !voice {
		return
	}
	speakResult(*errPtr == nil, time.Since(start).Round(time.Second).String())
}

func printRunHelp() {
	printSubUsage("run",
		"pushci run [flags]",
		"Execute the pushci.yml pipeline (or auto-detect if missing).",
		[][2]string{
			{"--dry-run, -n", "print the plan (stages + commands) without executing anything"},
			{"--parallel, -p", "run independent stages in parallel"},
			{"--stage, -s <name>", "run only the named stage"},
			{"--trace", "emit Perfetto performance trace"},
			{"--security", "run security scan after pipeline"},
			{"--with-deploy", "execute deploy block even when trigger: push|manual"},
			{"--verbose, -v", "stream all command output live (see what npm ci / wrangler is doing)"},
			{"--continue-on-failure", "keep running later stages after one fails"},
			{"--all", "include every project in monorepo (skip affected-files filter)"},
			{"--stress <n>", "run each check n times to detect flakes"},
			{"--voice", "speak the result via say (macOS) or espeak (Linux) on finish"},
		},
		[]string{
			"pushci run",
			"pushci run --dry-run",
			"pushci run --stage test",
		})
}
