package detect

import "path/filepath"

func detectPythonFramework(base string) string {
	// Django: manage.py OR wsgi.py is a strong file signal. Also accept
	// a literal `django` / `Django` dep when combined with either file.
	if fileExists(filepath.Join(base, "manage.py")) ||
		fileExists(filepath.Join(base, "wsgi.py")) {
		return "django"
	}
	if fileExists(filepath.Join(base, "scrapy.cfg")) {
		return "scrapy"
	}
	return detectPythonDeps(base)
}

// detectPythonDeps returns the primary Python web/data framework
// tag by matching LITERAL dependency names (not loose substrings).
// See python_deps.go for regex anchoring.
func detectPythonDeps(base string) string {
	switch {
	case hasPyDep(base, "django"):
		return "django"
	case hasPyDep(base, "fastapi"):
		return "fastapi"
	case hasPyDep(base, "flask"):
		return "flask"
	case hasPyDep(base, "streamlit"):
		return "streamlit"
	case hasPyDep(base, "celery"):
		return "celery"
	case hasPyDep(base, "apache-airflow"), hasPyDep(base, "airflow"):
		return "airflow"
	case hasPyDep(base, "torch"), hasPyDep(base, "tensorflow"):
		return "ml"
	}
	return ""
}

func detectJavaFramework(base string) string {
	if detectSpringBoot(base) {
		return "spring-boot"
	}
	return detectJavaFrameworkFromBuildFiles(base)
}

func detectRubyFramework(base string) string {
	if fileExists(filepath.Join(base, "config/routes.rb")) {
		return "rails"
	}
	if fileContains(filepath.Join(base, "Gemfile"), "sinatra") {
		return "sinatra"
	}
	return ""
}

func detectPHPFramework(base string) string {
	if fileExists(filepath.Join(base, "artisan")) {
		return "laravel"
	}
	if fileContains(filepath.Join(base, "composer.json"), "symfony") {
		return "symfony"
	}
	return ""
}
