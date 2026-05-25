package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func writeCsproj(t *testing.T, dir, name, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDetectCSharpFramework_AspNetSdkWeb(t *testing.T) {
	d := t.TempDir()
	writeCsproj(t, d, "App.csproj", `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
</Project>`)
	if got := detectCSharpFramework(d); got != "aspnetcore" {
		t.Errorf("got %q, want aspnetcore", got)
	}
}

func TestDetectCSharpFramework_Worker(t *testing.T) {
	d := t.TempDir()
	writeCsproj(t, d, "Svc.csproj", `<Project Sdk="Microsoft.NET.Sdk.Worker">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
</Project>`)
	if got := detectCSharpFramework(d); got != "aspnetcore" {
		t.Errorf("got %q, want aspnetcore (Worker SDK)", got)
	}
}

func TestDetectCSharpFramework_Blazor(t *testing.T) {
	d := t.TempDir()
	writeCsproj(t, d, "Wasm.csproj", `<Project Sdk="Microsoft.NET.Sdk.BlazorWebAssembly">
</Project>`)
	if got := detectCSharpFramework(d); got != "blazor" {
		t.Errorf("got %q, want blazor", got)
	}
}

func TestDetectCSharpFramework_PackageReferenceFallback(t *testing.T) {
	d := t.TempDir()
	writeCsproj(t, d, "Lib.csproj", `<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.App" />
  </ItemGroup>
</Project>`)
	if got := detectCSharpFramework(d); got != "aspnetcore" {
		t.Errorf("got %q, want aspnetcore (PackageReference fallback)", got)
	}
}

func TestDetectCSharpFramework_PlainLib(t *testing.T) {
	d := t.TempDir()
	writeCsproj(t, d, "Lib.csproj", `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup>
</Project>`)
	if got := detectCSharpFramework(d); got != "" {
		t.Errorf("got %q, want empty (plain class lib not ASP.NET)", got)
	}
}

func TestDetectCSharpFramework_NoCsproj(t *testing.T) {
	if got := detectCSharpFramework(t.TempDir()); got != "" {
		t.Errorf("got %q, want empty", got)
	}
}
