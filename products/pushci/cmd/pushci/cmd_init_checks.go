package main

import (
	"path/filepath"

	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

func buildCheckCommands(root string, stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.Node] {
		scripts := nodeScriptsFromProjects(root, projects)
		fw := nodeFrameworkFromProjects(projects)
		fb, ft, fl := nodeFrameworkChecks(fw, scripts)
		if fb != nil || ft != nil || fl != nil {
			build = append(build, fb...)
			test = append(test, ft...)
			lint = append(lint, fl...)
		} else {
			if scripts["build"] {
				build = append(build, config.Check{Name: "build", Run: "npm run build"})
			}
			if scripts["test"] {
				test = append(test, config.Check{Name: "test", Run: "npm test"})
			}
			if scripts["lint"] {
				lint = append(lint, config.Check{Name: "lint", Run: "npm run lint"})
			}
		}
	}
	if stacks[detect.Go] {
		build = append(build, config.Check{Name: "go-build", Run: "go build ./..."})
		if hasGoTestFiles(root) {
			test = append(test, config.Check{Name: "go-test", Run: "go test ./..."})
		}
		lint = append(lint, config.Check{Name: "go-vet", Run: "go vet ./..."})
	}
	if stacks[detect.Python] {
		pyProject := findPythonProject(projects)
		build = append(build, pythonBuildChecks(pyProject, root)...)
		pyBase := filepath.Join(root, pyProject.Dir)
		if pythonHasDjango(pyProject) || hasPythonTests(pyBase) {
			test = append(test, pythonTestChecks(pyProject)...)
		}
		lint = append(lint, pythonLintChecks(pyProject, root)...)
	}
	if stacks[detect.Rust] {
		build = append(build, config.Check{Name: "cargo-build", Run: "cargo build"})
		test = append(test, config.Check{Name: "cargo-test", Run: "cargo test"})
	}
	if stacks[detect.Java] {
		jb, jt := javaCheckCommands(projects)
		build = append(build, jb...)
		test = append(test, jt...)
	}
	if stacks[detect.Ruby] {
		test = append(test, config.Check{Name: "ruby-test", Run: "bundle exec rspec"})
		lint = append(lint, config.Check{Name: "rubocop", Run: "bundle exec rubocop"})
	}
	eb, et, el := allExtCheckCommands(root, stacks, projects)
	// No {Name: "test"} placeholder fallback. A bare `name: test`
	// without a Run field executes the BSD `test` utility (silent
	// success), misleading users into thinking tests ran. Callers
	// must supply an explicit Run command or skip the stage.
	return append(build, eb...), append(test, et...), append(lint, el...)
}

// javaCheckCommands returns Gradle or Maven checks based on the
// actual build tool for each Java project. Gradle-only repos no
// longer leak `mvn` into build stages — the telia v1.6.1 dogfood
// showed those runs failed instantly when no pom.xml existed.
func javaCheckCommands(projects []detect.Project) (build, test []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Java && p.BuildTool == detect.ToolGradle {
			g := "gradle"
			if detect.HasGradleWrapper(p.Dir) {
				g = "./gradlew"
			}
			return []config.Check{{Name: "gradle-build", Run: g + " build -x test"}},
				[]config.Check{{Name: "gradle-test", Run: g + " test"}}
		}
	}
	return []config.Check{{Name: "mvn-build", Run: "mvn compile -q"}},
		[]config.Check{{Name: "mvn-test", Run: "mvn test -q"}}
}
