package runner

// Runtime checks for Kotlin, Lua, Perl, R, Julia.

func kotlinChecks() []check {
	return []check{
		{"build", "kotlinc", []string{"src/*.kt", "-include-runtime", "-d", "app.jar"}},
		{"test", "kotlin", []string{"-cp", "app.jar", "MainKt"}},
	}
}

func luaChecks() []check {
	return []check{
		{"test", "busted", nil},
		{"lint", "luacheck", []string{"."}},
	}
}

func perlChecks() []check {
	return []check{
		{"install", "cpanm", []string{"--installdeps", "."}},
		{"test", "prove", []string{"-l", "t/"}},
	}
}

func rChecks() []check {
	return []check{
		{"build", "R", []string{"CMD", "build", "."}},
		{"test", "Rscript", []string{"-e", "testthat::test_dir('tests')"}},
	}
}

func juliaChecks() []check {
	return []check{
		{"install", "julia", []string{"-e", "using Pkg; Pkg.instantiate()"}},
		{"test", "julia", []string{"-e", "using Pkg; Pkg.test()"}},
	}
}
