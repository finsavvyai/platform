// Package detect — C# / .NET framework sub-detector.
//
// Strong-signal ASP.NET Core detection (mirrors the Spring Boot
// pattern in framework_java.go). A loose mention of "AspNetCore"
// anywhere in a csproj is intentionally NOT sufficient.

package detect

import (
	"os"
	"path/filepath"
	"regexp"
)

var (
	// <Project Sdk="Microsoft.NET.Sdk.Web"> — APIs, MVC, Razor Pages.
	reAspNetSdkWeb = regexp.MustCompile(
		`<Project\s+[^>]*Sdk\s*=\s*["']Microsoft\.NET\.Sdk\.Web["']`)
	// <Project Sdk="Microsoft.NET.Sdk.Worker"> — background services.
	reAspNetSdkWorker = regexp.MustCompile(
		`<Project\s+[^>]*Sdk\s*=\s*["']Microsoft\.NET\.Sdk\.Worker["']`)
	// <Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">.
	reBlazorSdk = regexp.MustCompile(
		`<Project\s+[^>]*Sdk\s*=\s*["']Microsoft\.NET\.Sdk\.BlazorWebAssembly["']`)
	// <PackageReference Include="Microsoft.AspNetCore...
	reAspNetPkgRef = regexp.MustCompile(
		`<PackageReference\s+[^>]*Include\s*=\s*["']Microsoft\.AspNetCore`)
)

// detectCSharpFramework walks all *.csproj in base and returns the
// strongest matching framework signal. Empty string when no signal.
func detectCSharpFramework(base string) string {
	entries, err := os.ReadDir(base)
	if err != nil {
		return ""
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".csproj" {
			continue
		}
		data, err := os.ReadFile(filepath.Join(base, e.Name()))
		if err != nil {
			continue
		}
		switch {
		case reBlazorSdk.Match(data):
			return "blazor"
		case reAspNetSdkWeb.Match(data), reAspNetSdkWorker.Match(data):
			return "aspnetcore"
		case reAspNetPkgRef.Match(data):
			return "aspnetcore"
		}
	}
	return ""
}
