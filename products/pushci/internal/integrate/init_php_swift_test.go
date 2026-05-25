package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitPHP(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"composer.json": `{"require":{"php":">=8.1"}}`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.PHP {
		t.Fatalf("expected php, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"install", "composer-install", "composer install"},
		{"test", "php-test", "vendor/bin/phpunit"},
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

func TestInitSwift(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"Package.swift": `// swift-tools-version:5.9
import PackageDescription
let package = Package(name: "MyApp")
`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Swift {
		t.Fatalf("expected swift, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"build", "swift-build", "swift build"},
		{"test", "swift-test", "swift test"},
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

func TestInitDart(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"pubspec.yaml": "name: myapp\nversion: 1.0.0\n",
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Dart {
		t.Fatalf("expected dart, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"install", "dart-install", "dart pub get"},
		{"test", "dart-test", "dart test"},
		{"lint", "dart-lint", "dart analyze"},
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
