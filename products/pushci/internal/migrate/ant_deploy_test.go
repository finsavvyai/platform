package migrate

import (
	"strings"
	"testing"
)

// Ant build.xml with a bare `deploy` target — we should auto-wire
// it into Deploys without any warning (it's unambiguous).
const antDeployBareXML = `<project name="svc" default="compile">
  <target name="compile"/>
  <target name="test"/>
  <target name="deploy"/>
</project>`

func TestConvertAnt_BareDeploy(t *testing.T) {
	r := ConvertAnt(antDeployBareXML, "build.xml")
	if len(r.Deploys) != 1 {
		t.Fatalf("Deploys = %d, want 1 (%v)", len(r.Deploys), r.Deploys)
	}
	d := r.Deploys[0]
	if d.Name != "deploy" || d.Run != "ant deploy" {
		t.Errorf("Deploys[0] = %+v, want name=deploy run=\"ant deploy\"", d)
	}
	if !branchListContains(d.OnlyOn, "main") {
		t.Errorf("bare deploy should gate on main, got %v", d.OnlyOn)
	}
	for _, w := range r.Warnings {
		if strings.Contains(w, "deploy") {
			t.Errorf("bare deploy must NOT warn, got: %q", w)
		}
	}
}

// Multi-env Ant deploys — deploy-prod gates on main, deploy-dev on develop.
const antMultiDeployXML = `<project name="svc">
  <target name="compile"/>
  <target name="deploy-prod"/>
  <target name="deploy-dev"/>
</project>`

func TestConvertAnt_EnvDeploys(t *testing.T) {
	r := ConvertAnt(antMultiDeployXML, "build.xml")
	if len(r.Deploys) != 2 {
		t.Fatalf("Deploys = %d, want 2 (%v)", len(r.Deploys), r.Deploys)
	}
	byName := map[string]AntDeployTarget{}
	for _, d := range r.Deploys {
		byName[d.Name] = d
	}
	if !branchListContains(byName["deploy-prod"].OnlyOn, "main") {
		t.Errorf("deploy-prod should include main, got %v", byName["deploy-prod"].OnlyOn)
	}
	if !branchListContains(byName["deploy-dev"].OnlyOn, "develop") {
		t.Errorf("deploy-dev should include develop, got %v", byName["deploy-dev"].OnlyOn)
	}
}

// No deploy-like targets → empty Deploys, no spurious "deploy" warning.
const antNoDeployXML = `<project name="svc">
  <target name="clean"/>
  <target name="compile"/>
  <target name="test"/>
  <target name="jar"/>
</project>`

func TestConvertAnt_NoDeploys(t *testing.T) {
	r := ConvertAnt(antNoDeployXML, "build.xml")
	if len(r.Deploys) != 0 {
		t.Errorf("Deploys = %d, want 0", len(r.Deploys))
	}
	for _, w := range r.Warnings {
		if strings.Contains(strings.ToLower(w), "deploy") {
			t.Errorf("should not warn about deploy when none present: %q", w)
		}
	}
}

// publish-nexus and upload-artifacts are both real deploys.
func TestConvertAnt_PublishUploadAreDeploys(t *testing.T) {
	xml := `<project><target name="compile"/><target name="publish-nexus"/><target name="upload-artifacts"/></project>`
	r := ConvertAnt(xml, "build.xml")
	if len(r.Deploys) != 2 {
		t.Fatalf("Deploys = %d, want 2 (%v)", len(r.Deploys), r.Deploys)
	}
}

// dist/jar/war must NOT be classified as deploys — they're the build stage.
func TestConvertAnt_BuildTargetsNotDeploys(t *testing.T) {
	xml := `<project><target name="dist"/><target name="jar"/><target name="war"/><target name="release"/></project>`
	r := ConvertAnt(xml, "build.xml")
	if len(r.Deploys) != 0 {
		t.Errorf("dist/jar/war/release should never be deploys, got %+v", r.Deploys)
	}
}

// "undeploy" must not match (prefix-only, not substring).
func TestIsAntDeployTarget_PrefixOnly(t *testing.T) {
	cases := map[string]bool{
		"deploy":       true,
		"deploy-prod":  true,
		"deploy_stage": true,
		"publish":      true,
		"undeploy":     false,
		"predeploy":    false,
		"compile":      false,
		"DeployProd":   false, // no separator after prefix
	}
	for name, want := range cases {
		if got := isAntDeployTarget(name); got != want {
			t.Errorf("isAntDeployTarget(%q) = %v, want %v", name, got, want)
		}
	}
}

func branchListContains(xs []string, want string) bool {
	for _, x := range xs {
		if x == want {
			return true
		}
	}
	return false
}
