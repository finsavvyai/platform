package ai

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/detect"
)

func defaultYAML(projects []detect.Project) string {
	var stages []string
	for _, p := range projects {
		if p.Stack == detect.Docker {
			continue
		}
		switch p.Stack {
		case detect.Go:
			stages = []string{
				"  - name: build\n    checks:\n      - name: go build\n        run: go build ./...",
				"  - name: test\n    checks:\n      - name: go test\n        run: go test ./... -count=1",
			}
		case detect.Node:
			stages = []string{
				"  - name: install\n    checks:\n      - name: npm install\n        run: npm install",
				"  - name: test\n    checks:\n      - name: npm test\n        run: npm test",
			}
		case detect.Python:
			stages = []string{
				"  - name: build\n    checks:\n      - name: install\n        run: pip install -r requirements.txt",
				"  - name: test\n    checks:\n      - name: pytest\n        run: pytest",
			}
		default:
			stages = []string{
				"  - name: build\n    checks:\n      - name: build\n        run: make build",
				"  - name: test\n    checks:\n      - name: test\n        run: make test",
			}
		}
		break
	}
	header := "on: [push, pull_request]\n"
	if len(stages) == 0 {
		return header + "stages: []\n"
	}
	return fmt.Sprintf("%sstages:\n%s\n", header, strings.Join(stages, "\n"))
}
