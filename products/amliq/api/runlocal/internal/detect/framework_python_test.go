package detect

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectPythonFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"django manage.py", func(d string) {
			os.WriteFile(filepath.Join(d, "manage.py"), []byte(""), 0o644)
		}, "django"},
		{"scrapy.cfg", func(d string) {
			os.WriteFile(filepath.Join(d, "scrapy.cfg"), []byte(""), 0o644)
		}, "scrapy"},
		{"fastapi in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("fastapi==0.100"), 0o644)
		}, "fastapi"},
		{"flask in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("flask==2.3"), 0o644)
		}, "flask"},
		{"streamlit in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("streamlit==1.28"), 0o644)
		}, "streamlit"},
		{"celery in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("celery==5.3"), 0o644)
		}, "celery"},
		{"airflow in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("apache-airflow==2.7"), 0o644)
		}, "airflow"},
		{"torch in requirements", func(d string) {
			os.WriteFile(filepath.Join(d, "requirements.txt"), []byte("torch==2.0"), 0o644)
		}, "ml"},
		{"tensorflow in pyproject", func(d string) {
			os.WriteFile(filepath.Join(d, "pyproject.toml"), []byte("tensorflow==2.14"), 0o644)
		}, "ml"},
		{"no framework", func(d string) {}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dir := t.TempDir()
			tt.setup(dir)
			if got := detectPythonFramework(dir); got != tt.want {
				t.Errorf("detectPythonFramework() = %q, want %q", got, tt.want)
			}
		})
	}
}
