package detect

// ScanCIProviders returns every foreign CI/CD system wired into the
// repo. The result is Stack-agnostic and DeployTarget-agnostic — it
// answers "what other CI platform does this repo already use?"
//
// Providers registered today:
//   - ci:jenkins               — any Jenkinsfile at root or up to depth 3
//   - ci:aws-codebuild         — buildspec.yml / buildspec.yaml / buildspec_*
//   - ci:aws-codebuild-tf      — resource "aws_codebuild_project"
//   - ci:aws-codepipeline-tf   — resource "aws_codepipeline"
//   - ci:gcp-cloudbuild-tf     — resource "google_cloudbuild_trigger"
//   - ci:azure-devops-tf       — resource "azuredevops_build_definition"
//   - ci:harness-tf            — resource "harness_platform_pipeline"
//   - ci:chef                  — Chef cookbooks/Berksfile/Policyfile/metadata.rb
//   - ci:ant                   — Apache Ant build.xml (root or depth 3)
//   - project:java-war-legacy  — WEB-INF/web.xml with no build tool
//   - project:shell-scripts    — *.sh at root with no build tool (LAST)
//
// Ordering matters for the `project:*` fallbacks — WAR-legacy must
// run before shell-only, and shell-only must run last so a repo with
// both signals gets classified as WAR. The generic CI scanners above
// remain order-independent.
func ScanCIProviders(root string) []CIProvider {
	var out []CIProvider
	seen := map[string]bool{}
	add := func(ps []CIProvider) {
		for _, p := range ps {
			k := ciProviderKey(p)
			if seen[k] {
				continue
			}
			seen[k] = true
			out = append(out, p)
		}
	}
	add(ScanJenkins(root))
	add(ScanBuildspec(root))
	add(ScanTerraformPipelines(root))
	if c := ScanChef(root); c != nil {
		add([]CIProvider{*c})
	}
	add(ScanAnt(root))
	if c := ScanLegacyWAR(root); c != nil {
		add([]CIProvider{*c})
	}
	if c := ScanShellOnly(root); c != nil {
		add([]CIProvider{*c})
	}
	return out
}
