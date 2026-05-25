package migrate

// deployScriptPatterns is ordered most-specific first. Platform
// names match the constants in internal/detect/deploy_markers.go
// where possible. Each entry's needles are AND-matched against a
// single lowercased script line.
var deployScriptPatterns = []struct {
	needles  []string
	platform string
}{
	{[]string{"aws ecs ", "update-service"}, "aws-ecs"},
	{[]string{"aws ecs ", "deploy"}, "aws-ecs"},
	{[]string{"eksctl"}, "aws-eks"},
	{[]string{"aws lambda update-function"}, "aws-lambda"},
	{[]string{"aws lambda publish"}, "aws-lambda"},
	{[]string{"serverless deploy"}, "aws-lambda"},
	{[]string{"sam deploy"}, "aws-sam"},
	{[]string{"aws apprunner"}, "aws-apprunner"},
	{[]string{"aws s3 sync"}, "aws-s3"},
	{[]string{"aws s3 cp"}, "aws-s3"},
	{[]string{"aws cloudformation deploy"}, "aws-cloudformation"},
	{[]string{"cdk deploy"}, "aws-cdk"},
	{[]string{"kubectl apply"}, "kubernetes"},
	{[]string{"kubectl rollout"}, "kubernetes"},
	{[]string{"helm upgrade"}, "helm"},
	{[]string{"helm install"}, "helm"},
	{[]string{"wrangler pages deploy"}, "cloudflare-pages"},
	{[]string{"wrangler deploy"}, "cloudflare-workers"},
	{[]string{"vercel deploy"}, "vercel"},
	{[]string{"vercel --prod"}, "vercel"},
	{[]string{"netlify deploy"}, "netlify"},
	{[]string{"fly deploy"}, "fly"},
	{[]string{"flyctl deploy"}, "fly"},
	{[]string{"railway up"}, "railway"},
	{[]string{"gcloud run deploy"}, "gcp-cloud-run"},
	{[]string{"gcloud app deploy"}, "gcp-app-engine"},
	{[]string{"az webapp deploy"}, "azure-webapp"},
	{[]string{"az functionapp deploy"}, "azure-functions"},
	{[]string{"az containerapp"}, "azure-containerapp"},
	{[]string{"terraform apply"}, "terraform"},
	{[]string{"pulumi up"}, "pulumi"},
	{[]string{"ansible-playbook"}, "ansible"},
	{[]string{"docker push"}, "docker"},
}
