resource "google_cloudbuild_trigger" "build_trigger" {
  name     = "my-build"
  filename = "cloudbuild.yaml"

  github {
    owner = "finsavvyai"
    name  = "pushci"

    push {
      branch = "^main$"
    }
  }
}
