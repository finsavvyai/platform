package migrate

import (
	"strings"
	"testing"
)

const sampleAntBuildXML = `<?xml version="1.0"?>
<project name="demo" default="compile">
  <target name="clean"/>
  <target name="compile"/>
  <target name="test"/>
  <target name="dist" depends="compile"/>
  <target name="weird-custom"/>
</project>
`

func TestConvertAnt_StandardTargets(t *testing.T) {
	r := ConvertAnt(sampleAntBuildXML, "build.xml")
	if r.StagesConverted != 4 {
		t.Errorf("stages = %d, want 4 (clean/compile/test/build)", r.StagesConverted)
	}
	for _, want := range []string{"ant clean", "ant compile", "ant test", "ant dist"} {
		if !strings.Contains(r.PushCIYAML, want) {
			t.Errorf("missing %q in:\n%s", want, r.PushCIYAML)
		}
	}
}

func TestConvertAnt_UnknownTargetWarning(t *testing.T) {
	r := ConvertAnt(sampleAntBuildXML, "build.xml")
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "weird-custom") {
		t.Errorf("expected warning about unknown target, got: %v", r.Warnings)
	}
}

func TestConvertAnt_PrefersJarWarOverBuild(t *testing.T) {
	xml := `<project><target name="jar"/><target name="build"/></project>`
	r := ConvertAnt(xml, "build.xml")
	if !strings.Contains(r.PushCIYAML, "ant jar") {
		t.Errorf("expected jar to win over build, got:\n%s", r.PushCIYAML)
	}
}

func TestConvertAnt_NoTargets(t *testing.T) {
	r := ConvertAnt(`<project/>`, "build.xml")
	if r.StagesConverted != 0 {
		t.Errorf("stages = %d, want 0", r.StagesConverted)
	}
	if len(r.Warnings) == 0 {
		t.Error("expected no-targets warning")
	}
}

func TestConvertAnt_SubdirEmitsDir(t *testing.T) {
	xml := `<project><target name="compile"/></project>`
	r := ConvertAnt(xml, "modules/util/build.xml")
	if !strings.Contains(r.PushCIYAML, "dir: modules/util") {
		t.Errorf("expected dir field for subdir build.xml, got:\n%s", r.PushCIYAML)
	}
}

func TestConvertAnt_DefaultTargetFallback(t *testing.T) {
	xml := `<project default="main"><target name="main"/></project>`
	r := ConvertAnt(xml, "build.xml")
	if !strings.Contains(r.PushCIYAML, "ant main") {
		t.Errorf("expected default-target fallback to emit 'ant main':\n%s", r.PushCIYAML)
	}
}
