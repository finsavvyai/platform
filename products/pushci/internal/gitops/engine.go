package gitops

import (
	"fmt"
	"time"
)

// EnvironmentStage represents a deployment stage.
type EnvironmentStage string

const (
	StageDev     EnvironmentStage = "dev"
	StageStaging EnvironmentStage = "staging"
	StageProd    EnvironmentStage = "production"
)

// Promotion represents a promotion from one stage to another.
type Promotion struct {
	From         EnvironmentStage `json:"from"`
	To           EnvironmentStage `json:"to"`
	SHA          string           `json:"sha"`
	Promoter     string           `json:"promoter"`
	Timestamp    time.Time        `json:"timestamp"`
	AutoApproved bool             `json:"auto_approved"`
}

// Workflow defines the promotion chain for GitOps.
type Workflow struct {
	Stages     []EnvironmentStage
	Promotions []Promotion
}

// NewWorkflow creates a standard dev→staging→prod workflow.
func NewWorkflow() *Workflow {
	return &Workflow{
		Stages: []EnvironmentStage{StageDev, StageStaging, StageProd},
	}
}

// NextStage returns the next stage after the given one.
func (w *Workflow) NextStage(current EnvironmentStage) (EnvironmentStage, error) {
	for i, s := range w.Stages {
		if s == current && i+1 < len(w.Stages) {
			return w.Stages[i+1], nil
		}
	}
	return "", fmt.Errorf("no next stage after %s", current)
}

// Promote creates a promotion record.
func (w *Workflow) Promote(from, to EnvironmentStage, sha, promoter string) *Promotion {
	p := Promotion{
		From: from, To: to, SHA: sha,
		Promoter: promoter, Timestamp: time.Now(),
	}
	w.Promotions = append(w.Promotions, p)
	return &p
}

// CurrentStage returns the highest stage the SHA has reached.
func (w *Workflow) CurrentStage(sha string) EnvironmentStage {
	highest := StageDev
	for _, p := range w.Promotions {
		if p.SHA == sha {
			for i, s := range w.Stages {
				if s == p.To && indexOf(w.Stages, highest) < i {
					highest = p.To
				}
			}
		}
	}
	return highest
}

func indexOf(stages []EnvironmentStage, target EnvironmentStage) int {
	for i, s := range stages {
		if s == target {
			return i
		}
	}
	return -1
}

// CanPromote checks if a SHA can be promoted to the next stage.
func (w *Workflow) CanPromote(sha string, to EnvironmentStage) bool {
	current := w.CurrentStage(sha)
	next, err := w.NextStage(current)
	if err != nil {
		return false
	}
	return next == to
}
