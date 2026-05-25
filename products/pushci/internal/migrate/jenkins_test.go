package migrate

import (
	"strings"
	"testing"
)

func TestConvertJenkinsfileDeclarativeHappyPath(t *testing.T) {
	raw := `pipeline {
  agent any
  environment { AWS_REGION = 'eu-north-1' }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Build') { steps { sh 'mvn clean install' } }
    stage('Test') { steps { sh 'mvn test' } }
    stage('Deploy') {
      when { branch 'main' }
      steps { sh 'docker push registry/app:latest' }
    }
  }
  post { failure { mail to: 'team@example.com', subject: 'Build failed' } }
}`
	r := ConvertJenkinsfile(raw)
	if r.StagesConverted != 3 {
		t.Errorf("stages = %d, want 3 (checkout has no sh step)", r.StagesConverted)
	}
	if !strings.Contains(r.PushCIYAML, "name: build") || !strings.Contains(r.PushCIYAML, "mvn clean install") {
		t.Errorf("missing Build stage in output:\n%s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "only_on:") || !strings.Contains(r.PushCIYAML, "- main") {
		t.Errorf("when { branch 'main' } not mapped to only_on:\n%s", r.PushCIYAML)
	}
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "post {") {
		t.Errorf("expected post-block warning, got:\n%s", joined)
	}
}

func TestConvertJenkinsfileScriptedBestEffort(t *testing.T) {
	raw := `node {
  stage('Build') { sh 'mvn package' }
  stage('Test') { sh 'mvn test' }
}`
	r := ConvertJenkinsfile(raw)
	if r.StagesConverted != 2 {
		t.Errorf("scripted stages = %d, want 2", r.StagesConverted)
	}
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "Scripted pipeline") {
		t.Errorf("expected scripted-pipeline warning, got:\n%s", joined)
	}
}

func TestConvertJenkinsfileCredentials(t *testing.T) {
	raw := `pipeline {
  agent any
  environment { DEPLOY_KEY = credentials('deploy-ssh-key') }
  stages {
    stage('Deploy') {
      steps {
        withCredentials([string(credentialsId: 'npm-token', variable: 'NPM_TOKEN')]) {
          sh 'npm publish'
        }
      }
    }
  }
}`
	r := ConvertJenkinsfile(raw)
	found := map[string]bool{}
	for _, v := range r.EnvVarsNeeded {
		if v.IsSecret {
			found[v.Name] = true
		}
	}
	if !found["DEPLOY_KEY"] {
		t.Error("DEPLOY_KEY not flagged as credentials-sourced secret")
	}
	if !found["NPM_TOKEN"] {
		t.Error("NPM_TOKEN not flagged as withCredentials binding")
	}
}

func TestConvertJenkinsfileParallelAndMatrix(t *testing.T) {
	raw := `pipeline {
  agent any
  stages {
    stage('Fan out') {
      parallel {
        stage('unit') { steps { sh 'mvn test' } }
        stage('lint') { steps { sh 'mvn checkstyle:check' } }
      }
    }
    stage('Matrix') {
      matrix {
        axes { axis { name 'OS'; values 'linux', 'mac' } }
        stages { stage('build') { steps { sh 'make' } } }
      }
    }
  }
}`
	r := ConvertJenkinsfile(raw)
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "parallel { ... }") {
		t.Errorf("missing parallel warning:\n%s", joined)
	}
	if !strings.Contains(joined, "matrix {") {
		t.Errorf("missing matrix warning:\n%s", joined)
	}
}

func TestConvertJenkinsfileTeliaStyle(t *testing.T) {
	raw := `pipeline {
  agent { docker { image 'maven:3.9-eclipse-temurin-17' } }
  environment {
    AWS_REGION = 'eu-north-1'
    ARTIFACT_BUCKET = 'telia-artifacts'
    NEXUS_CREDS = credentials('nexus-deploy')
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Build') { steps { sh 'mvn -B clean package -DskipTests' } }
    stage('Test') { steps { sh 'mvn -B test' } }
    stage('Docker') {
      when { branch 'main' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'ecr',
          usernameVariable: 'AWS_KEY', passwordVariable: 'AWS_SECRET')]) {
          sh 'aws ecr get-login-password | docker login'
          sh 'docker build -t app:$BUILD_NUMBER .'
          sh 'docker push app:$BUILD_NUMBER'
        }
      }
    }
  }
  post { always { archiveArtifacts 'target/*.jar' } }
}`
	r := ConvertJenkinsfile(raw)
	if r.StagesConverted < 3 {
		t.Errorf("Telia-style stages = %d, want >=3", r.StagesConverted)
	}
	if !strings.Contains(r.PushCIYAML, "mvn -B clean package") {
		t.Errorf("missing Maven command:\n%s", r.PushCIYAML)
	}
	secrets := map[string]bool{}
	for _, v := range r.EnvVarsNeeded {
		if v.IsSecret {
			secrets[v.Name] = true
		}
	}
	for _, want := range []string{"NEXUS_CREDS", "AWS_KEY", "AWS_SECRET"} {
		if !secrets[want] {
			t.Errorf("expected %s flagged as secret, have: %v", want, secrets)
		}
	}
	joined := strings.Join(r.Warnings, "\n")
	if !strings.Contains(joined, "Docker image: maven:3.9") {
		t.Errorf("missing docker-agent warning:\n%s", joined)
	}
	if !strings.Contains(joined, "post {") {
		t.Errorf("missing post warning:\n%s", joined)
	}
}

func TestConvertJenkinsfileEmpty(t *testing.T) {
	r := ConvertJenkinsfile("")
	if r.StagesConverted != 0 {
		t.Errorf("empty input should yield 0 stages, got %d", r.StagesConverted)
	}
}
