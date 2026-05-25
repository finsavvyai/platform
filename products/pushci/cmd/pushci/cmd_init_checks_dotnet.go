package main

import (
	"github.com/finsavvyai/pushci/internal/config"
	"github.com/finsavvyai/pushci/internal/detect"
)

// dotnetCheckCommands returns dotnet build/test, plus a publish step
// when any project is detected as ASP.NET Core or Blazor (deploy-ready).
func dotnetCheckCommands(projects []detect.Project) (build, test []config.Check) {
	build = append(build, config.Check{Name: "dotnet-build", Run: "dotnet build"})
	test = append(test, config.Check{Name: "dotnet-test", Run: "dotnet test"})
	for _, p := range projects {
		if p.Stack != detect.CSharp {
			continue
		}
		if p.Framework == "aspnetcore" || p.Framework == "blazor" {
			build = append(build, config.Check{
				Name: "dotnet-publish",
				Run:  "dotnet publish -c Release -o publish",
			})
			return
		}
	}
	return
}
