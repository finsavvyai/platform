package integrate

import (
	"testing"

	"github.com/finsavvyai/pushci/internal/detect"
)

func TestInitElixir(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"mix.exs": `defmodule MyApp.MixProject do
  use Mix.Project
  def project do [app: :myapp, version: "0.1.0"] end
end
`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Elixir {
		t.Fatalf("expected elixir, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"install", "mix-install", "mix deps.get"},
		{"build", "mix-build", "mix compile"},
		{"test", "mix-test", "mix test"},
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

func TestInitScala(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"build.sbt": `name := "myapp"
version := "0.1.0"
scalaVersion := "3.3.1"
`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.Scala {
		t.Fatalf("expected scala, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"build", "sbt-build", "sbt compile"},
		{"test", "sbt-test", "sbt test"},
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

func TestInitCSharp(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"MyApp.csproj": `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
</Project>`,
	})

	pipe, projects := scanAndBuild(dir)
	if len(projects) == 0 || projects[0].Stack != detect.CSharp {
		t.Fatalf("expected csharp, got %+v", projects)
	}
	cases := []struct {
		stage, check, run string
	}{
		{"install", "dotnet-install", "dotnet restore"},
		{"build", "dotnet-build", "dotnet build"},
		{"test", "dotnet-test", "dotnet test"},
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
