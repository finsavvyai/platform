package integrate

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// intExt3Checks returns build/test/lint for Kotlin, Lua, Perl, R, Julia.
func intExt3Checks(stacks map[detect.Stack]bool) (build, test, lint []config.Check) {
	if stacks[detect.Kotlin] {
		build = append(build, config.Check{Name: "kotlin-build", Run: "kotlinc src/*.kt -include-runtime -d app.jar"})
		test = append(test, config.Check{Name: "kotlin-test", Run: "kotlin -cp app.jar MainKt"})
	}
	if stacks[detect.Lua] {
		test = append(test, config.Check{Name: "lua-test", Run: "busted"})
		lint = append(lint, config.Check{Name: "lua-lint", Run: "luacheck ."})
	}
	if stacks[detect.Perl] {
		test = append(test, config.Check{Name: "perl-test", Run: "prove -l t/"})
	}
	if stacks[detect.R] {
		build = append(build, config.Check{Name: "r-build", Run: "R CMD build ."})
		test = append(test, config.Check{Name: "r-test", Run: `Rscript -e "testthat::test_dir('tests')"`})
	}
	if stacks[detect.Julia] {
		test = append(test, config.Check{Name: "julia-test", Run: `julia -e "using Pkg; Pkg.test()"`})
	}
	return
}
