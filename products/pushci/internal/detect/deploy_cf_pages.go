package detect

import (
	"os"
	"path/filepath"
	"strings"
)

// enrichCFPages scans GitHub Actions workflows for the
// cloudflare/pages-action and extracts projectName + directory
// so the generated deploy command includes --project-name.
// Without this, `wrangler pages deploy dist` silently fails
// because wrangler doesn't know which Pages project to target.
func enrichCFPages(root string, targets []DeployTarget) {
	projName, outDir := findCFPagesConfig(root)
	if projName == "" {
		return
	}
	for i := range targets {
		if targets[i].Platform != "cloudflare-pages" {
			continue
		}
		// Rebuild the command with the discovered project name.
		// The directory field from GitHub Actions (e.g. "web/dist")
		// is relative to the repo root, but the marker command
		// already cd's into the frontend dir (e.g. "cd web && ...").
		// Strip the frontend dir prefix so we don't double-nest:
		// "cd web && wrangler pages deploy web/dist" is wrong,
		// "cd web && wrangler pages deploy dist" is correct.
		dir := outDir
		if dir == "" {
			dir = "dist"
		}
		parts := strings.SplitN(targets[i].Command, "npx wrangler", 2)
		prefix := ""
		if len(parts) == 2 {
			prefix = parts[0]
		}
		// Strip the cd directory from the output path if present.
		// "cd web && ..." + "web/dist" → strip "web/" → "dist"
		if cdDir := extractCdDir(prefix); cdDir != "" {
			dir = strings.TrimPrefix(dir, cdDir+"/")
		}
		branch := detectDefaultBranch(root)
		targets[i].Command = prefix + "npx wrangler pages deploy " +
			dir + " --project-name=" + projName + " --branch=" + branch
	}
}

// findCFPagesConfig reads .github/workflows/*.yml looking for
// cloudflare/pages-action with projectName and directory inputs.
func findCFPagesConfig(root string) (project, dir string) {
	wfDir := filepath.Join(root, ".github", "workflows")
	entries, err := os.ReadDir(wfDir)
	if err != nil {
		return "", ""
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".yml") && !strings.HasSuffix(name, ".yaml") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(wfDir, name))
		if err != nil {
			continue
		}
		content := string(data)
		if !strings.Contains(content, "pages-action") {
			continue
		}
		project = extractYAMLField(content, "projectName")
		dir = extractYAMLField(content, "directory")
		if project != "" {
			return project, dir
		}
	}
	return "", ""
}
