resource "azuredevops_build_definition" "ci" {
  project_id = "abc123"
  name       = "My CI Build"

  repository {
    repo_id  = "finsavvyai/pushci"
    repo_type = "GitHub"
    yml_path = "azure-pipelines.yml"
  }
}
