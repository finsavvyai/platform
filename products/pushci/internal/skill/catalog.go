package skill

// NewCatalog returns a registry pre-loaded with all built-in skills.
func NewCatalog() *Registry {
	r := NewRegistry()
	for i := range builtinSkills {
		_ = r.Register(&builtinSkills[i])
	}
	return r
}

var builtinSkills = []Skill{
	// --- Templates ---
	{
		ID: "nextjs-vercel", Name: "Next.js + Vercel", Version: "1.0.0",
		Category: CategoryTemplate, Author: "pushci", Verified: true, Installs: 12400,
		Description: "Full CI/CD pipeline for Next.js apps with Vercel deployment.",
		Tags:        []string{"Next.js", "Vercel", "React", "TypeScript"},
		Steps: []Step{
			{Name: "Install", Run: "npm ci"},
			{Name: "Lint", Run: "npx next lint"},
			{Name: "Test", Run: "npm test", OnFail: "block"},
			{Name: "Build", Run: "npx next build", OnFail: "block"},
			{Name: "Deploy", Run: "npx vercel --prod"},
		},
	},
	{
		ID: "django-aws", Name: "Django + AWS", Version: "1.0.0",
		Category: CategoryTemplate, Author: "pushci", Verified: true, Installs: 8100,
		Description: "Python Django pipeline with pytest, migrations check, and AWS ECS deployment.",
		Tags:        []string{"Python", "Django", "AWS", "ECS"},
		Steps: []Step{
			{Name: "Install", Run: "pip install -r requirements.txt"},
			{Name: "Migrations", Run: "python manage.py migrate --check"},
			{Name: "Test", Run: "pytest --tb=short", OnFail: "block"},
			{Name: "Deploy", Run: "aws ecs update-service --cluster main --service web --force-new-deployment"},
		},
	},
	{
		ID: "go-docker", Name: "Go + Docker", Version: "1.0.0",
		Category: CategoryTemplate, Author: "pushci", Verified: true, Installs: 9700,
		Description: "Go pipeline with race detection, benchmarks, Docker image build, and registry push.",
		Tags:        []string{"Go", "Docker", "Kubernetes"},
		Steps: []Step{
			{Name: "Vet", Run: "go vet ./..."},
			{Name: "Test", Run: "go test -race ./...", OnFail: "block"},
			{Name: "Build Image", Run: "docker build -t $IMAGE:$SHA ."},
			{Name: "Push Image", Run: "docker push $IMAGE:$SHA"},
		},
	},
	{
		ID: "rails-fly", Name: "Rails + Fly.io", Version: "1.0.0",
		Category: CategoryTemplate, Author: "community", Verified: false, Installs: 3200,
		Description: "Ruby on Rails pipeline with RSpec, database migrations, and Fly.io deployment.",
		Tags:        []string{"Ruby", "Rails", "Fly.io", "PostgreSQL"},
		Steps: []Step{
			{Name: "Install", Run: "bundle install"},
			{Name: "DB Setup", Run: "bin/rails db:test:prepare"},
			{Name: "Test", Run: "bundle exec rspec", OnFail: "block"},
			{Name: "Deploy", Run: "fly deploy"},
		},
	},
	{
		ID: "rust-shuttle", Name: "Rust + Shuttle", Version: "1.0.0",
		Category: CategoryTemplate, Author: "community", Verified: false, Installs: 2800,
		Description: "Rust pipeline with clippy linting, cargo test, and Shuttle.rs deployment.",
		Tags:        []string{"Rust", "Shuttle", "Actix", "Axum"},
		Steps: []Step{
			{Name: "Clippy", Run: "cargo clippy -- -D warnings"},
			{Name: "Test", Run: "cargo test", OnFail: "block"},
			{Name: "Deploy", Run: "cargo shuttle deploy"},
		},
	},
	{
		ID: "flutter-firebase", Name: "Flutter + Firebase", Version: "1.0.0",
		Category: CategoryTemplate, Author: "pushci", Verified: true, Installs: 5600,
		Description: "Flutter pipeline with widget tests and Firebase App Distribution.",
		Tags:        []string{"Dart", "Flutter", "Firebase", "Mobile"},
		Steps: []Step{
			{Name: "Get Deps", Run: "flutter pub get"},
			{Name: "Analyze", Run: "flutter analyze"},
			{Name: "Test", Run: "flutter test", OnFail: "block"},
			{Name: "Build", Run: "flutter build apk --release"},
			{Name: "Distribute", Run: "firebase appdistribution:distribute build/app/outputs/flutter-apk/app-release.apk"},
		},
	},
}
