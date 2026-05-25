package migrate

import (
	"strings"
	"testing"
)

const droneSingle = `kind: pipeline
type: docker
name: default
steps:
  - name: test
    image: node:20
    commands:
      - npm ci
      - npm test
  - name: build
    image: node:20
    commands:
      - npm run build
    depends_on:
      - test
`

const droneMulti = `kind: pipeline
type: docker
name: backend
steps:
  - name: test
    image: golang:1.22
    commands:
      - go test ./...
---
kind: pipeline
type: docker
name: frontend
steps:
  - name: build
    image: node:20
    commands:
      - npm run build
`

const droneUnsupported = `kind: pipeline
type: ssh
name: deploy
steps:
  - name: ship
    commands:
      - ./deploy.sh
`

const droneWithServicesAndWhen = `kind: pipeline
type: docker
name: ci
services:
  - name: postgres
    image: postgres:16
trigger:
  branch:
    - main
steps:
  - name: itest
    image: node:20
    commands:
      - npm run itest
    when:
      branch: main
    environment:
      DATABASE_URL: postgres://db
`

func TestConvertDroneSingleDoc(t *testing.T) {
	r := ConvertDrone(droneSingle)
	if r.PipelinesFound != 1 {
		t.Fatalf("pipelines = %d, want 1", r.PipelinesFound)
	}
	if r.StepsKept != 2 {
		t.Errorf("steps kept = %d, want 2", r.StepsKept)
	}
	if !strings.Contains(r.PushCIYAML, "npm ci && npm test") {
		t.Errorf("commands not joined: %s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "depends_on:\n      - test") {
		t.Errorf("depends_on missing: %s", r.PushCIYAML)
	}
}

func TestConvertDroneMultiDoc(t *testing.T) {
	r := ConvertDrone(droneMulti)
	if r.PipelinesFound != 2 {
		t.Fatalf("pipelines = %d, want 2", r.PipelinesFound)
	}
	if !strings.Contains(r.PushCIYAML, "backend-test") {
		t.Errorf("missing prefixed stage backend-test: %s", r.PushCIYAML)
	}
	if !strings.Contains(r.PushCIYAML, "frontend-build") {
		t.Errorf("missing prefixed stage frontend-build: %s", r.PushCIYAML)
	}
}

func TestConvertDroneUnsupportedType(t *testing.T) {
	r := ConvertDrone(droneUnsupported)
	if r.StepsKept != 0 {
		t.Errorf("steps kept = %d, want 0 for ssh pipeline", r.StepsKept)
	}
	found := false
	for _, w := range r.Warnings {
		if strings.Contains(w, "type: ssh") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected warning about type: ssh, got %v", r.Warnings)
	}
}

func TestConvertDroneServicesAndWhen(t *testing.T) {
	r := ConvertDrone(droneWithServicesAndWhen)
	var hasSvc, hasWhen, hasTrig bool
	for _, w := range r.Warnings {
		if strings.Contains(w, "services") {
			hasSvc = true
		}
		if strings.Contains(w, "'when:'") {
			hasWhen = true
		}
		if strings.Contains(w, "trigger block") {
			hasTrig = true
		}
	}
	if !hasSvc || !hasWhen || !hasTrig {
		t.Errorf("missing warnings svc=%v when=%v trig=%v (warnings=%v)",
			hasSvc, hasWhen, hasTrig, r.Warnings)
	}
	if !strings.Contains(r.PushCIYAML, "DATABASE_URL:") {
		t.Errorf("env not emitted: %s", r.PushCIYAML)
	}
}

func TestConvertDroneInvalidYAML(t *testing.T) {
	r := ConvertDrone("::: not yaml :::")
	if len(r.Warnings) == 0 {
		t.Error("expected a parse warning on invalid yaml")
	}
}
