package integrate

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// checkCmds builds build/test/lint checks for all detected stacks.
func checkCmds(root string, stacks map[detect.Stack]bool, projects []detect.Project) (build, test, lint []config.Check) {
	if stacks[detect.Node] {
		scripts := mergeNodeScripts(root, projects)
		fw := nodeFWFromProjects(projects)
		fb, ft, fl := intNodeFWChecks(fw, scripts)
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
		test = append(test, config.Check{Name: "go-test", Run: "go test ./..."})
		lint = append(lint, config.Check{Name: "go-vet", Run: "go vet ./..."})
	}
	if stacks[detect.Python] {
		pp := findPy(projects)
		build = append(build, pyBuild(pp, root)...)
		test = append(test, pyTest(pp)...)
		lint = append(lint, pyLint(pp, root)...)
	}
	if stacks[detect.Rust] {
		build = append(build, config.Check{Name: "cargo-build", Run: "cargo build"})
		test = append(test, config.Check{Name: "cargo-test", Run: "cargo test"})
	}
	if stacks[detect.Java] {
		jb, jt := intJavaChecks(projects)
		build = append(build, jb...)
		test = append(test, jt...)
	}
	if stacks[detect.Ruby] {
		test = append(test, config.Check{Name: "ruby-test", Run: "bundle exec rspec"})
		lint = append(lint, config.Check{Name: "rubocop", Run: "bundle exec rubocop"})
	}
	eb, et, el := intExtChecks(stacks, projects)
	build = append(build, eb...)
	test = append(test, et...)
	lint = append(lint, el...)
	e2b, e2t, e2l := intExt2Checks(stacks, projects)
	build = append(build, e2b...)
	test = append(test, e2t...)
	lint = append(lint, e2l...)
	e3b, e3t, e3l := intExt3Checks(stacks)
	build = append(build, e3b...)
	test = append(test, e3t...)
	lint = append(lint, e3l...)
	e4b, e4t, e4l := intExt4Checks(stacks, projects)
	build = append(build, e4b...)
	test = append(test, e4t...)
	lint = append(lint, e4l...)
	return
}

// intJavaChecks returns Gradle or Maven checks based on build tool.
func intJavaChecks(projects []detect.Project) ([]config.Check, []config.Check) {
	for _, p := range projects {
		if p.Stack == detect.Java && p.BuildTool == detect.ToolGradle {
			return []config.Check{{Name: "gradle-build", Run: "./gradlew build"}},
				[]config.Check{{Name: "gradle-test", Run: "./gradlew test"}}
		}
	}
	return []config.Check{{Name: "mvn-build", Run: "mvn compile -q"}},
		[]config.Check{{Name: "mvn-test", Run: "mvn test -q"}}
}
