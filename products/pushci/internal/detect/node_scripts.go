package detect

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// NodeScripts reads package.json and returns available script names.
func NodeScripts(dir string) map[string]bool {
	pkg := filepath.Join(dir, "package.json")
	data, err := os.ReadFile(pkg)
	if err != nil {
		return nil
	}
	var raw struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}
	result := map[string]bool{}
	for name, cmd := range raw.Scripts {
		if name == "test" && isDefaultTestScript(cmd) {
			continue
		}
		result[name] = true
	}
	return result
}

// isDefaultTestScript returns true for npm init's placeholder test script.
func isDefaultTestScript(cmd string) bool {
	return cmd == "" ||
		cmd == "echo \"Error: no test specified\" && exit 1"
}
