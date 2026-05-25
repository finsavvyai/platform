package templates

import "strings"

func (r *Registry) loadBuiltins() {
	builtins := []Template{
		{ID: "node-basic", Name: "Node.js Basic", Stack: "node", Public: true,
			Description: "Install, lint, test, build for Node.js projects",
			Tags:        []string{"node", "npm", "javascript"},
			YAML:        "on: [push]\nchecks:\n  - npm install\n  - npm run lint\n  - npm test\n  - npm run build\n"},
		{ID: "go-basic", Name: "Go Basic", Stack: "go", Public: true,
			Description: "Vet, test, build for Go projects",
			Tags:        []string{"go", "golang"},
			YAML:        "on: [push]\nchecks:\n  - go vet ./...\n  - go test ./...\n  - go build ./...\n"},
		{ID: "python-basic", Name: "Python Basic", Stack: "python", Public: true,
			Description: "Lint, test for Python projects",
			Tags:        []string{"python", "pip"},
			YAML:        "on: [push]\nchecks:\n  - pip install -r requirements.txt\n  - flake8\n  - pytest\n"},
		{ID: "docker-build", Name: "Docker Build & Push", Stack: "docker", Public: true,
			Description: "Build and push Docker images",
			Tags:        []string{"docker", "container"},
			YAML:        "on: [push]\nchecks:\n  - docker build -t $IMAGE .\n  - docker push $IMAGE\n"},
		{ID: "security-scan", Name: "Security Scanning", Stack: "any", Public: true,
			Description: "SAST + dependency scanning pipeline",
			Tags:        []string{"security", "sast", "audit"},
			YAML:        "on: [push]\nchecks:\n  - npm audit\n  - trivy fs .\n  - semgrep scan\n"},
		{ID: "k8s-deploy", Name: "Kubernetes Deploy", Stack: "k8s", Public: true,
			Description: "Build, test, deploy to Kubernetes",
			Tags:        []string{"kubernetes", "k8s", "deploy"},
			YAML:        "on: [push]\nchecks:\n  - build\n  - test\n  - kubectl apply -f k8s/\n"},
	}
	for i := range builtins {
		builtins[i].Author = "pushci"
		builtins[i].Version = "1.0.0"
		r.templates[builtins[i].ID] = &builtins[i]
	}
}

func matchesQuery(t *Template, query string) bool {
	q := strings.ToLower(query)
	if strings.Contains(strings.ToLower(t.Name), q) {
		return true
	}
	if strings.Contains(strings.ToLower(t.Description), q) {
		return true
	}
	for _, tag := range t.Tags {
		if strings.Contains(tag, q) {
			return true
		}
	}
	return false
}
