package detect

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// turboJSON represents the minimal structure of turbo.json.
type turboJSON struct {
	Pipeline map[string]interface{} `json:"pipeline"`
	Tasks    map[string]interface{} `json:"tasks"`
}

// IsTurboRepo returns true if the root contains a turbo.json file.
func IsTurboRepo(root string) bool {
	return fileExists(filepath.Join(root, "turbo.json"))
}

// TurboProjects scans a Turbo monorepo and returns detected sub-projects.
// It reads workspace globs from package.json and detects each workspace.
func TurboProjects(root string) []Project {
	workspaceDirs := resolveWorkspaces(root)
	if len(workspaceDirs) == 0 {
		return nil
	}

	var projects []Project
	for _, dir := range workspaceDirs {
		abs := filepath.Join(root, dir)
		if !fileExists(filepath.Join(abs, "package.json")) {
			continue
		}
		rel := dir
		p := Project{
			Stack:     Node,
			BuildTool: ToolNpm,
			Dir:       rel,
			Framework: detectNodeFramework(abs),
		}
		projects = append(projects, p)
	}
	return projects
}

// resolveWorkspaces reads workspace patterns from root package.json.
func resolveWorkspaces(root string) []string {
	data, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil
	}
	var pkg struct {
		Workspaces []string `json:"workspaces"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil
	}

	var dirs []string
	for _, pattern := range pkg.Workspaces {
		glob := filepath.Join(root, pattern)
		matches, err := filepath.Glob(glob)
		if err != nil {
			continue
		}
		for _, m := range matches {
			rel, _ := filepath.Rel(root, m)
			if rel != "" {
				dirs = append(dirs, rel)
			}
		}
	}
	return dirs
}

// TurboTasks returns the task names defined in turbo.json.
func TurboTasks(root string) []string {
	data, err := os.ReadFile(filepath.Join(root, "turbo.json"))
	if err != nil {
		return nil
	}
	var t turboJSON
	if err := json.Unmarshal(data, &t); err != nil {
		return nil
	}
	tasks := t.Tasks
	if len(tasks) == 0 {
		tasks = t.Pipeline
	}
	names := make([]string, 0, len(tasks))
	for name := range tasks {
		names = append(names, name)
	}
	return names
}
