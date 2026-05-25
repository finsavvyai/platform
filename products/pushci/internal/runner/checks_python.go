package runner

import "github.com/finsavvyai/pushci/internal/detect"

func pythonChecks(p detect.Project) []check {
	var c []check

	// Install deps
	switch p.BuildTool {
	case detect.ToolPoetry:
		c = append(c, check{"install", "poetry", []string{"install"}})
	default:
		c = append(c, check{"install", "pip", []string{"install", "-r", "requirements.txt"}})
	}

	// Test (framework-aware)
	switch p.Framework {
	case "django":
		c = append(c, check{"test", "python", []string{"manage.py", "test"}})
	default:
		c = append(c, check{"test", "pytest", nil})
	}
	return c
}

func dartChecks(p detect.Project) []check {
	if p.Framework == "flutter" {
		return []check{
			{"analyze", "flutter", []string{"analyze"}},
			{"test", "flutter", []string{"test"}},
		}
	}
	return []check{
		{"analyze", "dart", []string{"analyze"}},
		{"test", "dart", []string{"test"}},
	}
}
