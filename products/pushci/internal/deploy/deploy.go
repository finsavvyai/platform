package deploy

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

// Target represents a deployment destination.
type Target string

const (
	TargetCloudflarePages   Target = "cloudflare-pages"
	TargetCloudflareWorkers Target = "cloudflare-workers"
	TargetAWSECS            Target = "aws-ecs"
	TargetAWSLambda         Target = "aws-lambda"
	TargetAWSS3             Target = "aws-s3"
	TargetGCPCloudRun       Target = "gcp-cloud-run"
	TargetGCPAppEngine      Target = "gcp-app-engine"
	TargetAzureAppService   Target = "azure-app-service"
	TargetDocker            Target = "docker"
	TargetK8s               Target = "kubernetes"
	TargetVercel            Target = "vercel"
	TargetRailway           Target = "railway"
	TargetFly               Target = "fly"
	TargetRender            Target = "render"
	TargetNetlify           Target = "netlify"
	TargetSSH               Target = "ssh"
	// IaC targets are defined in their respective files.
)

// Result holds deploy outcome.
type Result struct {
	Target  Target
	Success bool
	Output  string
	URL     string
}

// Deploy executes a deployment to the given target.
func Deploy(ctx context.Context, target Target, dir string, env map[string]string) *Result {
	driver, ok := drivers[target]
	if !ok {
		return &Result{Target: target, Output: fmt.Sprintf("unknown target: %s", target)}
	}
	return driver(ctx, dir, env)
}

type deployFunc func(ctx context.Context, dir string, env map[string]string) *Result

var drivers = map[Target]deployFunc{
	TargetCloudflarePages:   cfPages,
	TargetCloudflareWorkers: cfWorkers,
	TargetAWSECS:            awsECS,
	TargetAWSLambda:         awsLambda,
	TargetAWSS3:             awsS3,
	TargetGCPCloudRun:       gcpCloudRun,
	TargetGCPAppEngine:      gcpAppEngine,
	TargetAzureAppService:   azureApp,
	TargetDocker:            docker,
	TargetK8s:               k8s,
	TargetVercel:            vercel,
	TargetRailway:           railway,
	TargetFly:               fly,
	TargetRender:            render,
	TargetNetlify:           netlify,
	TargetSSH:               sshDeploy,
	TargetTerraform:         terraform,
	TargetCloudFormation:    cloudFormation,
	TargetPulumi:            pulumi,
	TargetAnsible:           ansible,
	TargetBicep:             bicep,
	TargetAzureFunctions:    azureFunctions,
}

func run(ctx context.Context, dir string, env map[string]string, cmd string, args ...string) *Result {
	c := exec.CommandContext(ctx, cmd, args...)
	c.Dir = dir
	for k, v := range env {
		c.Env = append(c.Env, k+"="+v)
	}
	out, err := c.CombinedOutput()
	return &Result{
		Success: err == nil,
		Output:  strings.TrimSpace(string(out)),
	}
}
