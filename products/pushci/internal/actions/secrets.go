package actions

import (
	"fmt"
	"os"
	"sort"
	"strings"
)

// writeSecretsFile materializes a map of secrets into act's expected
// .secrets file format (KEY=value, one per line). It returns the path
// to the temporary file, which the caller MUST clean up via os.Remove.
//
// Values are written verbatim. Newlines inside values are escaped to \n
// because act's parser is line-oriented and would otherwise truncate.
//
// File mode is 0600 so the file is unreadable by other users on
// shared systems — secrets must never widen permissions.
func writeSecretsFile(secrets map[string]string) (string, error) {
	if len(secrets) == 0 {
		return "", nil
	}
	f, err := os.CreateTemp("", "pushci-act-secrets-*")
	if err != nil {
		return "", fmt.Errorf("create secrets file: %w", err)
	}
	if err := f.Chmod(0600); err != nil {
		_ = f.Close()
		_ = os.Remove(f.Name())
		return "", fmt.Errorf("chmod secrets file: %w", err)
	}

	keys := make([]string, 0, len(secrets))
	for k := range secrets {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		escaped := strings.ReplaceAll(secrets[k], "\n", `\n`)
		if _, err := fmt.Fprintf(f, "%s=%s\n", k, escaped); err != nil {
			_ = f.Close()
			_ = os.Remove(f.Name())
			return "", fmt.Errorf("write secret: %w", err)
		}
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}

// writeEnvFile materializes a map of environment variables into act's
// .env file format. Same lifecycle contract as writeSecretsFile.
func writeEnvFile(env map[string]string) (string, error) {
	if len(env) == 0 {
		return "", nil
	}
	f, err := os.CreateTemp("", "pushci-act-env-*")
	if err != nil {
		return "", err
	}
	if err := f.Chmod(0600); err != nil {
		_ = f.Close()
		_ = os.Remove(f.Name())
		return "", err
	}
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		escaped := strings.ReplaceAll(env[k], "\n", `\n`)
		if _, err := fmt.Fprintf(f, "%s=%s\n", k, escaped); err != nil {
			_ = f.Close()
			_ = os.Remove(f.Name())
			return "", err
		}
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(f.Name())
		return "", err
	}
	return f.Name(), nil
}
