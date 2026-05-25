package ml

import (
	"context"
	"fmt"
	"time"
)

// ScheduleFrequency defines how often scheduled retraining runs.
type ScheduleFrequency string

const (
	ScheduleFrequencyDaily  ScheduleFrequency = "DAILY"
	ScheduleFrequencyWeekly ScheduleFrequency = "WEEKLY"
	ScheduleFrequencyCustom ScheduleFrequency = "CUSTOM"
)

// RetrainScheduleConfig holds configuration for the retrain scheduler.
type RetrainScheduleConfig struct {
	Frequency      ScheduleFrequency `json:"frequency"`
	DriftThreshold float64           `json:"drift_threshold"`
	CooldownHours  int               `json:"cooldown_hours"`
	Enabled        bool              `json:"enabled"`
	LastRetrainAt  *time.Time        `json:"last_retrain_at,omitempty"`
	ModelType      string            `json:"model_type"`
}

// RetrainDecision captures the outcome of a check-and-retrain evaluation.
type RetrainDecision struct {
	ShouldRetrain bool         `json:"should_retrain"`
	Reason        string       `json:"reason"`
	DriftScore    float64      `json:"drift_score"`
	DriftReport   *DriftReport `json:"drift_report,omitempty"`
	Job           *TrainingJob `json:"job,omitempty"`
}

// RetrainScheduler evaluates drift and triggers retraining when needed.
type RetrainScheduler struct {
	detector     DriftDetector
	orchestrator TrainingOrchestrator
	config       RetrainScheduleConfig
}

// NewRetrainScheduler creates a scheduler with the given dependencies.
func NewRetrainScheduler(
	detector DriftDetector,
	orchestrator TrainingOrchestrator,
	config RetrainScheduleConfig,
) *RetrainScheduler {
	return &RetrainScheduler{
		detector:     detector,
		orchestrator: orchestrator,
		config:       config,
	}
}

// CheckAndRetrain runs drift detection and triggers retraining when
// drift exceeds the configured threshold and the cooldown has elapsed.
func (s *RetrainScheduler) CheckAndRetrain(
	ctx context.Context, tenantID string,
) (*RetrainDecision, error) {
	if !s.config.Enabled {
		return &RetrainDecision{
			ShouldRetrain: false,
			Reason:        "scheduler is disabled",
		}, nil
	}

	report, err := s.detector.Detect(ctx, tenantID, 24)
	if err != nil {
		return nil, fmt.Errorf("drift detection failed: %w", err)
	}

	decision := &RetrainDecision{
		DriftScore:  report.OverallDriftScore,
		DriftReport: report,
	}

	if report.OverallDriftScore <= s.config.DriftThreshold {
		decision.Reason = fmt.Sprintf(
			"drift score %.4f is within threshold %.4f",
			report.OverallDriftScore, s.config.DriftThreshold,
		)
		return decision, nil
	}

	if !s.IsCooldownElapsed() {
		decision.Reason = "cooldown period has not elapsed"
		return decision, nil
	}

	job, err := s.orchestrator.TriggerRetrain(ctx, tenantID, s.config.ModelType)
	if err != nil {
		return nil, fmt.Errorf("trigger retrain failed: %w", err)
	}

	now := time.Now().UTC()
	s.config.LastRetrainAt = &now
	decision.ShouldRetrain = true
	decision.Reason = fmt.Sprintf(
		"drift score %.4f exceeds threshold %.4f",
		report.OverallDriftScore, s.config.DriftThreshold,
	)
	decision.Job = job
	return decision, nil
}

// IsCooldownElapsed returns true if enough time has passed since
// the last retrain, or if no retrain has occurred yet.
func (s *RetrainScheduler) IsCooldownElapsed() bool {
	if s.config.LastRetrainAt == nil {
		return true
	}
	elapsed := time.Since(*s.config.LastRetrainAt)
	return elapsed >= time.Duration(s.config.CooldownHours)*time.Hour
}

// GetConfig returns a copy of the current schedule configuration.
func (s *RetrainScheduler) GetConfig() RetrainScheduleConfig {
	return s.config
}

// UpdateConfig replaces the current schedule configuration.
func (s *RetrainScheduler) UpdateConfig(config RetrainScheduleConfig) {
	s.config = config
}

// ValidateScheduleConfig checks that a RetrainScheduleConfig is valid.
func ValidateScheduleConfig(cfg RetrainScheduleConfig) error {
	if cfg.DriftThreshold < 0 || cfg.DriftThreshold > 1 {
		return fmt.Errorf(
			"drift_threshold must be between 0 and 1, got %f",
			cfg.DriftThreshold,
		)
	}
	if cfg.CooldownHours < 0 {
		return fmt.Errorf(
			"cooldown_hours must be non-negative, got %d",
			cfg.CooldownHours,
		)
	}
	if cfg.ModelType == "" {
		return fmt.Errorf("model_type is required")
	}
	validFreq := map[ScheduleFrequency]bool{
		ScheduleFrequencyDaily:  true,
		ScheduleFrequencyWeekly: true,
		ScheduleFrequencyCustom: true,
	}
	if !validFreq[cfg.Frequency] {
		return fmt.Errorf("invalid frequency: %s", cfg.Frequency)
	}
	return nil
}
