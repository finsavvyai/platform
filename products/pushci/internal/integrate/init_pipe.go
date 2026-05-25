package integrate

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// buildSingle creates install/build/test/lint stages for a single-dir project.
func buildSingle(root string, stacks map[detect.Stack]bool, projects []detect.Project) []config.Stage {
	install := installChecks(stacks)
	build, test, lint := checkCmds(root, stacks, projects)
	return []config.Stage{
		{Name: "install", Checks: install},
		{Name: "build", DependsOn: []string{"install"}, Checks: build},
		{Name: "test", DependsOn: []string{"install"}, Parallel: true, Checks: test},
		{Name: "lint", DependsOn: []string{"install"}, Parallel: true, Checks: lint},
	}
}

// buildMonorepo creates per-project stages for multi-dir repos.
func buildMonorepo(root string, projects []detect.Project) []config.Stage {
	var stages []config.Stage
	for _, p := range projects {
		if p.Stack == detect.Docker {
			continue
		}
		stacks := map[detect.Stack]bool{p.Stack: true}
		dir := p.Dir
		if dir == "." {
			dir = ""
		}
		prefix := dir
		if prefix == "" {
			prefix = string(p.Stack)
		}
		inst := fmt.Sprintf("%s-install", prefix)
		install := installChecks(stacks)
		build, test, lint := checkCmds(root, stacks, []detect.Project{p})
		stages = append(stages, config.Stage{Name: inst, Dir: dir, Checks: install})
		if len(build) > 0 {
			stages = append(stages, config.Stage{Name: prefix + "-build", Dir: dir, DependsOn: []string{inst}, Checks: build})
		}
		if len(test) > 0 {
			stages = append(stages, config.Stage{Name: prefix + "-test", Dir: dir, DependsOn: []string{inst}, Checks: test})
		}
		if len(lint) > 0 {
			stages = append(stages, config.Stage{Name: prefix + "-lint", Dir: dir, DependsOn: []string{inst}, Checks: lint})
		}
	}
	return stages
}

func installChecks(stacks map[detect.Stack]bool) []config.Check {
	m := map[detect.Stack]string{
		detect.Node: "npm install", detect.Python: "pip install -r requirements.txt",
		detect.Go: "go mod download", detect.Rust: "cargo fetch",
		detect.Java: "mvn dependency:resolve -q", detect.Ruby: "bundle install",
		detect.PHP: "composer install", detect.Dart: "dart pub get",
		detect.Elixir: "mix deps.get", detect.CSharp: "dotnet restore",
		// Clojure default: Leiningen. deps.edn/bb.edn/shadow repos
		// override this in intClojureInstallCheck below.
		detect.Clojure:   "lein deps",
		detect.Terraform: "terraform init",
		detect.Helm:      "helm dependency update",
		detect.Solidity:  "forge install",
		detect.Bun:       "bun install",
	}
	var checks []config.Check
	for s, cmd := range m {
		if stacks[s] {
			parts := strings.Fields(cmd)
			checks = append(checks, config.Check{Name: parts[0] + "-install", Run: cmd})
		}
	}
	return checks
}
