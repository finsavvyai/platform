package main

import "os"

func collectEnv() map[string]string {
	env := make(map[string]string)
	for _, e := range os.Environ() {
		if k, v, ok := splitEnv(e); ok {
			env[k] = v
		}
	}
	return env
}

func splitEnv(e string) (string, string, bool) {
	for i := 0; i < len(e); i++ {
		if e[i] == '=' {
			return e[:i], e[i+1:], true
		}
	}
	return "", "", false
}

func deployFlagSpecs() []FlagSpec {
	return []FlagSpec{
		{Long: "--stage", Aliases: []string{"-s"}, Takes: true},
	}
}

func flagValue(args []string, flags ...string) string {
	for i, a := range args {
		for _, f := range flags {
			if a == f && i+1 < len(args) {
				return args[i+1]
			}
		}
	}
	return ""
}
