package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitJava(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"pom.xml": `<project><modelVersion>4.0.0</modelVersion></project>`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Java {
		t.Fatalf("expected java, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"install", "mvn-install", "mvn dependency:resolve -q"},
		{"build", "mvn-build", "mvn compile -q"},
		{"test", "mvn-test", "mvn test -q"},
	}
	for _, tc := range cases {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
			continue
		}
		if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}

func TestInitRuby(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"Gemfile": "source 'https://rubygems.org'\ngem 'rspec'\ngem 'rubocop'\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Ruby {
		t.Fatalf("stack = %s, want ruby", projects[0].Stack)
	}

	if s := hasStage(pipe, "install"); s == nil {
		t.Error("missing install stage")
	} else if checkRun(s, "bundle-install") != "bundle install" {
		t.Errorf("install = %q", checkRun(s, "bundle-install"))
	}
	if s := hasStage(pipe, "test"); s == nil {
		t.Error("missing test stage")
	} else if checkRun(s, "ruby-test") != "bundle exec rspec" {
		t.Errorf("test = %q", checkRun(s, "ruby-test"))
	}
	if s := hasStage(pipe, "lint"); s == nil {
		t.Error("missing lint stage")
	} else if checkRun(s, "rubocop") != "bundle exec rubocop" {
		t.Errorf("lint = %q", checkRun(s, "rubocop"))
	}
}

func TestInitRust(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"Cargo.toml": "[package]\nname = \"myapp\"\nversion = \"0.1.0\"\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 {
		t.Fatal("no projects detected")
	}
	if projects[0].Stack != detect.Rust {
		t.Fatalf("stack = %s, want rust", projects[0].Stack)
	}

	cases := []struct {
		stage, check, run string
	}{
		{"install", "cargo-install", "cargo fetch"},
		{"build", "cargo-build", "cargo build"},
		{"test", "cargo-test", "cargo test"},
	}
	for _, tc := range cases {
		s := hasStage(pipe, tc.stage)
		if s == nil {
			t.Errorf("missing stage %q", tc.stage)
			continue
		}
		if got := checkRun(s, tc.check); got != tc.run {
			t.Errorf("%s/%s run = %q, want %q", tc.stage, tc.check, got, tc.run)
		}
	}
}
