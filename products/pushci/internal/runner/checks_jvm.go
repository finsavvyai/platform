package runner

import "github.com/finsavvyai/pushci/internal/detect"

func javaChecks(p detect.Project) []check {
	switch p.BuildTool {
	case detect.ToolMaven:
		return []check{
			{"build", "mvn", []string{"compile", "-q"}},
			{"test", "mvn", []string{"test", "-q"}},
		}
	case detect.ToolGradle:
		return []check{
			{"build", "./gradlew", []string{"build", "-x", "test"}},
			{"test", "./gradlew", []string{"test"}},
		}
	}
	return nil
}
