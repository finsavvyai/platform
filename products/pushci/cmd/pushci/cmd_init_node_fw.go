package main

import "github.com/finsavvyai/pushci/internal/config"

// nodeFrameworkChecks returns framework-specific checks for Node projects.
// Falls back to nil (generic Node pipeline) if no special handling needed.
func nodeFrameworkChecks(fw string, scripts map[string]bool) (build, test, lint []config.Check) {
	switch fw {
	case "expo":
		return expoChecks(scripts)
	case "electron":
		return electronChecks(scripts)
	case "t3", "cra", "angular", "vue":
		return spaChecks(fw, scripts)
	default:
		return nil, nil, nil
	}
}

func expoChecks(scripts map[string]bool) (build, test, lint []config.Check) {
	build = []config.Check{{Name: "expo-export", Run: "npx expo export"}}
	if scripts["test"] {
		test = []config.Check{{Name: "expo-test", Run: "npm test"}}
	}
	if scripts["lint"] {
		lint = []config.Check{{Name: "expo-lint", Run: "npm run lint"}}
	}
	lint = append(lint, config.Check{Name: "expo-doctor", Run: "npx expo-doctor"})
	return
}

func electronChecks(scripts map[string]bool) (build, test, lint []config.Check) {
	if scripts["build"] {
		build = []config.Check{{Name: "electron-build", Run: "npm run build"}}
	}
	if scripts["test"] {
		test = []config.Check{{Name: "electron-test", Run: "npm test"}}
	}
	if scripts["lint"] {
		lint = []config.Check{{Name: "electron-lint", Run: "npm run lint"}}
	}
	return
}

func spaChecks(fw string, scripts map[string]bool) (build, test, lint []config.Check) {
	if scripts["build"] {
		build = []config.Check{{Name: fw + "-build", Run: "npm run build"}}
	}
	if scripts["test"] {
		test = []config.Check{{Name: fw + "-test", Run: "npm test"}}
	}
	if scripts["lint"] {
		lint = []config.Check{{Name: fw + "-lint", Run: "npm run lint"}}
	}
	return
}
