// Terraform scanner + pipeline generator tests.

import { describe, it, expect } from "vitest";
import { scanTerraformFiles, preprocessHcl } from "./terraform";
import { buildTerraformPipeline } from "./terraform-routes";

const PROVIDERS_TF = `
terraform {
  required_version = "~> 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
  }
}
`;

const S3_BACKEND_TF = `
terraform {
  backend "s3" {
    bucket = "norlys-tfstate"
    key    = "prod/billing/terraform.tfstate"
    region = "eu-north-1"
  }
}
`;

const REMOTE_BACKEND_TF = `
terraform {
  backend "remote" {
    organization = "norlys"
    workspaces {
      name = "billing-prod"
    }
  }
}
`;

const MODULE_TF = `
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"
  cidr    = "10.0.0.0/16"
}

module "local_stuff" {
  source = "./modules/stuff"
}
`;

const VARS_TF = `
variable "region" {
  type    = string
  default = "eu-north-1"
}

variable "instance_count" {
  type = number
}
`;

const COMMENTED_TF = `
# terraform {
#   required_providers {
#     evil = { source = "bad/evil" }
#   }
# }

terraform {
  required_providers {
    good = { source = "hashicorp/good" }
  }
}
`;

const HEREDOC_TF = `
resource "null_resource" "x" {
  triggers = {
    script = <<EOT
    terraform {
      required_providers {
        evil = { source = "bad/evil" }
      }
    }
    EOT
  }
}

terraform {
  required_providers {
    real = { source = "hashicorp/real" }
  }
}
`;

describe("preprocessHcl", () => {
  it("strips hash comments", () => {
    const out = preprocessHcl("# comment\nfoo = 1");
    expect(out).not.toContain("comment");
    expect(out).toContain("foo = 1");
  });

  it("strips slash comments", () => {
    const out = preprocessHcl("// comment\nbar = 2");
    expect(out).not.toContain("comment");
    expect(out).toContain("bar = 2");
  });

  it("strips heredoc bodies", () => {
    const out = preprocessHcl(`script = <<EOT\nevil block\nEOT\nfoo = 1`);
    expect(out).not.toContain("evil");
    expect(out).toContain("foo = 1");
  });
});

describe("scanTerraformFiles", () => {
  it("parses required_providers with source + version", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: PROVIDERS_TF },
    ]);
    expect(scan.providers).toHaveLength(2);
    const aws = scan.providers.find((p) => p.name === "aws");
    expect(aws?.source).toBe("hashicorp/aws");
    expect(aws?.version).toBe(">= 5.0");
  });

  it("detects required_version", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: PROVIDERS_TF },
    ]);
    expect(scan.requiredVersion).toBe("~> 1.5");
  });

  it("parses S3 backend config", () => {
    const scan = scanTerraformFiles([
      { path: "backend.tf", content: S3_BACKEND_TF },
    ]);
    expect(scan.backend?.type).toBe("s3");
    expect(scan.backend?.config.bucket).toBe("norlys-tfstate");
    expect(scan.backend?.config.region).toBe("eu-north-1");
  });

  it("parses remote backend with organization + workspaces", () => {
    const scan = scanTerraformFiles([
      { path: "backend.tf", content: REMOTE_BACKEND_TF },
    ]);
    expect(scan.backend?.type).toBe("remote");
    expect(scan.backend?.config.organization).toBe("norlys");
    expect(scan.workspaceHints).toContain("billing-prod");
  });

  it("parses module block with source + version", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: MODULE_TF },
    ]);
    const vpc = scan.modules.find((m) => m.name === "vpc");
    expect(vpc?.source).toBe("terraform-aws-modules/vpc/aws");
    expect(vpc?.version).toBe("5.5.0");
  });

  it("parses local module (source = ./modules/foo)", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: MODULE_TF },
    ]);
    const local = scan.modules.find((m) => m.name === "local_stuff");
    expect(local?.source).toBe("./modules/stuff");
    expect(local?.version).toBeUndefined();
  });

  it("parses variable declarations", () => {
    const scan = scanTerraformFiles([
      { path: "vars.tf", content: VARS_TF },
    ]);
    expect(scan.variables).toEqual(["region", "instance_count"]);
  });

  it("ignores commented-out provider blocks", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: COMMENTED_TF },
    ]);
    expect(scan.providers.map((p) => p.name)).toEqual(["good"]);
  });

  it("ignores heredoc bodies", () => {
    const scan = scanTerraformFiles([
      { path: "main.tf", content: HEREDOC_TF },
    ]);
    expect(scan.providers.map((p) => p.name)).toEqual(["real"]);
  });

  it("aggregates across multiple files", () => {
    const scan = scanTerraformFiles([
      { path: "providers.tf", content: PROVIDERS_TF },
      { path: "backend.tf", content: S3_BACKEND_TF },
      { path: "main.tf", content: MODULE_TF },
      { path: "vars.tf", content: VARS_TF },
    ]);
    expect(scan.providers.length).toBe(2);
    expect(scan.modules.length).toBe(2);
    expect(scan.backend?.type).toBe("s3");
    expect(scan.variables.length).toBe(2);
  });
});

describe("buildTerraformPipeline", () => {
  const baseScan = scanTerraformFiles([
    { path: "main.tf", content: PROVIDERS_TF },
  ]);

  it("includes terraform fmt -check", () => {
    const out = buildTerraformPipeline(baseScan);
    expect(out.yaml).toContain("terraform fmt -check -recursive");
  });

  it("includes tfsec when skipSecurity is false", () => {
    const out = buildTerraformPipeline(baseScan, { skipSecurity: false });
    expect(out.yaml).toContain("tfsec .");
    expect(out.yaml).toContain("checkov -d .");
    expect(out.explanation.securityEnabled).toBe(true);
  });

  it("excludes tfsec when skipSecurity is true", () => {
    const out = buildTerraformPipeline(baseScan, { skipSecurity: true });
    expect(out.yaml).not.toContain("tfsec");
    expect(out.yaml).not.toContain("checkov");
    expect(out.explanation.securityEnabled).toBe(false);
  });

  it("sets -backend=false on init when backend=none", () => {
    const out = buildTerraformPipeline(baseScan, { backend: "none" });
    expect(out.yaml).toContain("terraform init -backend=false");
  });

  it("omits -backend=false on init when backend=configured", () => {
    const out = buildTerraformPipeline(baseScan, { backend: "configured" });
    expect(out.yaml).toContain("terraform init -input=false");
    expect(out.yaml).not.toContain("-backend=false");
  });

  it("includes plan artifact upload", () => {
    const out = buildTerraformPipeline(baseScan);
    expect(out.yaml).toContain("terraform plan -out=tfplan");
    expect(out.yaml).toMatch(/artifacts:\s*\n\s*- tfplan/);
  });

  it("caches .terraform/ and plugin-cache", () => {
    const out = buildTerraformPipeline(baseScan);
    expect(out.yaml).toContain(".terraform/");
    expect(out.yaml).toContain("~/.terraform.d/plugin-cache/");
  });

  it("passes --var-file when provided", () => {
    const out = buildTerraformPipeline(baseScan, {
      varFile: "prod.tfvars",
    });
    expect(out.yaml).toContain("-var-file=prod.tfvars");
  });
});
