resource "harness_platform_pipeline" "deploy" {
  identifier = "deploy_pipeline"
  name       = "Deploy Pipeline"
  project_id = "default_project"
  org_id     = "default_org"

  yaml = <<-EOT
    pipeline:
      name: Deploy Pipeline
      identifier: deploy_pipeline
      stages:
        - stage:
            name: build
            identifier: build
  EOT
}
