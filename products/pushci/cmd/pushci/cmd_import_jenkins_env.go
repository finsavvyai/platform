package main

import (
	"regexp"
	"strings"
)

var envRe = regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s\n]+))`)

func parseEnvBlock(body string) map[string]string {
	env := map[string]string{}
	for _, m := range envRe.FindAllStringSubmatch(body, -1) {
		val := m[2]
		if val == "" {
			val = m[3]
		}
		if val == "" {
			val = m[4]
		}
		env[m[1]] = val
	}
	return env
}

var shRe = regexp.MustCompile(`(?s)\bsh\s*\(?\s*(?:'([^']*)'|"([^"]*)")\s*\)?`)

func parseShSteps(body string) []string {
	var steps []string
	for _, m := range shRe.FindAllStringSubmatch(body, -1) {
		v := m[1]
		if v == "" {
			v = m[2]
		}
		v = strings.TrimSpace(v)
		if v != "" {
			steps = append(steps, v)
		}
	}
	return steps
}
