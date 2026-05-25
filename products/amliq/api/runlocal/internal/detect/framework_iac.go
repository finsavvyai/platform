package detect

import "path/filepath"

// detectTerraformProvider detects cloud provider from .tf files.
func detectTerraformProvider(base string) string {
	for _, f := range findGlob(base, "*.tf", 1) {
		switch {
		case fileContains(f, "provider \"aws\""),
			fileContains(f, "aws_"):
			return "terraform-aws"
		case fileContains(f, "provider \"google\""),
			fileContains(f, "google_"):
			return "terraform-gcp"
		case fileContains(f, "provider \"azurerm\""),
			fileContains(f, "azurerm_"):
			return "terraform-azure"
		}
	}
	return "terraform"
}

// detectCloudFormationType distinguishes SAM from plain CFN.
func detectCloudFormationType(base string) string {
	for _, f := range []string{"template.yaml", "template.yml"} {
		p := filepath.Join(base, f)
		if fileContains(p, "AWS::Serverless") {
			return "sam"
		}
		if fileContains(p, "AWSTemplateFormatVersion") {
			return "cloudformation"
		}
	}
	return ""
}
