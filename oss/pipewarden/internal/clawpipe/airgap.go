package clawpipe

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// EnvOfflineOnly is the environment variable name that, when set to a truthy
// value ("1", "true", "yes" — case-insensitive), forbids any analyzer in the
// pipewarden process from reaching out to a third-party AI service such as
// api.anthropic.com or a remote ClawPipe endpoint. The intent is to satisfy
// air-gap deployments where outbound AI traffic is contractually
// disallowed; it is a release-engineering knob, not a security boundary.
const EnvOfflineOnly = "PIPEWARDEN_OFFLINE_ONLY"

// EnvBundledLlamafile is the optional override path to a llamafile binary
// shipped alongside the pipewarden binary in the air-gap variant archive.
// When unset, BundledLlamafile probes <executable_dir>/llamafile.
const EnvBundledLlamafile = "PIPEWARDEN_BUNDLED_LLAMAFILE"

// ErrOfflineOnly is returned by analyzers that detect an outbound-AI
// attempt while PIPEWARDEN_OFFLINE_ONLY is enabled. Sentinel so callers
// can errors.Is() without string matching.
var ErrOfflineOnly = errors.New("pipewarden: refusing outbound AI call: PIPEWARDEN_OFFLINE_ONLY=1")

// IsOfflineOnly reports whether the air-gap mode is enabled in the
// current process environment. Cheap to call — re-reads env each time so
// tests can flip it without re-importing.
func IsOfflineOnly() bool {
	return isTruthy(os.Getenv(EnvOfflineOnly))
}

func isTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

// BundledLlamafilePath returns the absolute path to the llamafile binary
// bundled alongside pipewarden in the air-gap archive variant. Resolution
// order:
//
//  1. PIPEWARDEN_BUNDLED_LLAMAFILE if set and the file exists.
//  2. <dir-of-current-executable>/llamafile if it exists.
//  3. "" with a non-nil error if neither resolves.
//
// Existence is verified with os.Stat; the file is not opened so this is
// safe to call from health-check code paths.
func BundledLlamafilePath() (string, error) {
	if override := os.Getenv(EnvBundledLlamafile); override != "" {
		if _, err := os.Stat(override); err == nil {
			return override, nil
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	candidate := filepath.Join(filepath.Dir(exe), "llamafile")
	if _, err := os.Stat(candidate); err == nil {
		return candidate, nil
	}
	return "", errors.New("bundled llamafile not found next to pipewarden binary")
}
