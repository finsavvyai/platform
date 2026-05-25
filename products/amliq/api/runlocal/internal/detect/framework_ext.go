package detect

import "path/filepath"

func detectPythonFramework(base string) string {
	for _, f := range []string{"manage.py", "wsgi.py"} {
		if fileExists(filepath.Join(base, f)) {
			return "django"
		}
	}
	if fileExists(filepath.Join(base, "scrapy.cfg")) {
		return "scrapy"
	}
	return detectPythonDeps(base)
}

func detectPythonDeps(base string) string {
	for _, f := range []string{"pyproject.toml", "requirements.txt"} {
		p := filepath.Join(base, f)
		switch {
		case fileContains(p, "fastapi"):
			return "fastapi"
		case fileContains(p, "flask"):
			return "flask"
		case fileContains(p, "streamlit"):
			return "streamlit"
		case fileContains(p, "celery"):
			return "celery"
		case fileContains(p, "airflow"):
			return "airflow"
		case fileContains(p, "torch"), fileContains(p, "tensorflow"):
			return "ml"
		}
	}
	return ""
}

func detectJavaFramework(base string) string {
	for _, f := range []string{"pom.xml", "build.gradle", "build.gradle.kts"} {
		p := filepath.Join(base, f)
		switch {
		case fileContains(p, "spring-boot"):
			return "spring-boot"
		case fileContains(p, "quarkus"):
			return "quarkus"
		case fileContains(p, "micronaut"):
			return "micronaut"
		case fileContains(p, "com.android"):
			return "android"
		case fileContains(p, "kotlin"):
			return "kotlin"
		}
	}
	return ""
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
