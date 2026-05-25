package integrate

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// nodeFWFromProjects returns the framework of the first Node project.
func nodeFWFromProjects(projects []detect.Project) string {
	for _, p := range projects {
		if p.Stack == detect.Node && p.Framework != "" {
			return p.Framework
		}
	}
	return ""
}

// intNodeFWChecks mirrors cmd_init_node_fw.go for integration tests.
func intNodeFWChecks(fw string, scripts map[string]bool) (build, test, lint []config.Check) {
	switch fw {
	case "expo":
		build = []config.Check{{Name: "expo-export", Run: "npx expo export"}}
		if scripts["test"] {
			test = []config.Check{{Name: "expo-test", Run: "npm test"}}
		}
		if scripts["lint"] {
			lint = []config.Check{{Name: "expo-lint", Run: "npm run lint"}}
		}
		lint = append(lint, config.Check{Name: "expo-doctor", Run: "npx expo-doctor"})
	case "electron":
		if scripts["build"] {
			build = []config.Check{{Name: "electron-build", Run: "npm run build"}}
		}
		if scripts["test"] {
			test = []config.Check{{Name: "electron-test", Run: "npm test"}}
		}
		if scripts["lint"] {
			lint = []config.Check{{Name: "electron-lint", Run: "npm run lint"}}
		}
	case "t3", "cra", "angular", "vue":
		if scripts["build"] {
			build = []config.Check{{Name: fw + "-build", Run: "npm run build"}}
		}
		if scripts["test"] {
			test = []config.Check{{Name: fw + "-test", Run: "npm test"}}
		}
		if scripts["lint"] {
			lint = []config.Check{{Name: fw + "-lint", Run: "npm run lint"}}
		}
	default:
		return nil, nil, nil
	}
	return
}
