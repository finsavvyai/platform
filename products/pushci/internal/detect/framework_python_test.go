package detect

import (
	"os"
	"path/filepath"
	"testing"
)

// write a requirements.txt quickly
func writeReq(t *testing.T, d, body string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(d, "requirements.txt"), []byte(body), 0o644); err != nil {
		t.Fatalf("write requirements.txt: %v", err)
	}
}

func TestDetectPythonFramework(t *testing.T) {
	tests := []struct {
		name  string
		setup func(dir string)
		want  string
	}{
		{"django manage.py", func(d string) {
			os.WriteFile(filepath.Join(d, "manage.py"), []byte(""), 0o644)
		}, "django"},
		{"django in requirements", func(d string) {
			writeReq(t, d, "Django==4.2\n")
		}, "django"},
		{"scrapy.cfg", func(d string) {
			os.WriteFile(filepath.Join(d, "scrapy.cfg"), []byte(""), 0o644)
		}, "scrapy"},
		{"fastapi exact", func(d string) {
			writeReq(t, d, "fastapi==0.100\n")
		}, "fastapi"},
		{"fastapi plain", func(d string) {
			writeReq(t, d, "fastapi\n")
		}, "fastapi"},
		{"fastapi with extras", func(d string) {
			writeReq(t, d, "fastapi[all]>=0.100\n")
		}, "fastapi"},
		{"fastapi in poetry pyproject", func(d string) {
			os.WriteFile(filepath.Join(d, "pyproject.toml"),
				[]byte("[tool.poetry.dependencies]\nfastapi = \"^0.100\"\n"), 0o644)
		}, "fastapi"},
		// Bug D false positives — must NOT match:
		{"fastapi-users alone (no fastapi)", func(d string) {
			writeReq(t, d, "fastapi-users==1.0\n")
		}, ""},
		{"fastapi only in a url comment", func(d string) {
			writeReq(t, d, "# see https://fastapi.tiangolo.com\nboto3==1.20\n")
		}, ""},
		{"lambda-layers plain boto3", func(d string) {
			writeReq(t, d, "boto3==1.20\nbotocore==1.23\n")
		}, ""},
		{"flask in requirements", func(d string) {
			writeReq(t, d, "flask==2.3\n")
		}, "flask"},
		{"flask-login alone is NOT flask", func(d string) {
			writeReq(t, d, "flask-login==0.6\n")
		}, ""},
		{"flask + flask-login BOTH → flask", func(d string) {
			writeReq(t, d, "flask==2.3\nflask-login==0.6\n")
		}, "flask"},
		{"streamlit in requirements", func(d string) {
			writeReq(t, d, "streamlit==1.28\n")
		}, "streamlit"},
		{"celery in requirements", func(d string) {
			writeReq(t, d, "celery==5.3\n")
		}, "celery"},
		{"airflow (apache-airflow) in requirements", func(d string) {
			writeReq(t, d, "apache-airflow==2.7\n")
		}, "airflow"},
		{"torch in requirements", func(d string) {
			writeReq(t, d, "torch==2.0\n")
		}, "ml"},
		{"tensorflow in pyproject", func(d string) {
			os.WriteFile(filepath.Join(d, "pyproject.toml"),
				[]byte("dependencies = [\"tensorflow>=2.14\"]\n"), 0o644)
		}, "ml"},
		{"empty project → no framework", func(d string) {}, ""},
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
