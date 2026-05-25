package ml

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockDriftDetector implements DriftDetector for testing.
type mockDriftDetector struct {
	report *DriftReport
	err    error
}

func (m *mockDriftDetector) Detect(_ context.Context, _ string, _ int) (*DriftReport, error) {
	return m.report, m.err
}

func newTestConfig(enabled bool, threshold float64) RetrainScheduleConfig {
	return RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: threshold,
		CooldownHours:  1,
		Enabled:        enabled,
		ModelType:      "fraud_v1",
	}
}

func TestCheckAndRetrain_TriggersWhenDriftExceedsThreshold(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.8},
	}
	orch := NewInMemoryOrchestrator()
	cfg := newTestConfig(true, 0.5)
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.True(t, decision.ShouldRetrain)
	assert.NotNil(t, decision.Job)
	assert.Contains(t, decision.Reason, "exceeds threshold")
	assert.Equal(t, 0.8, decision.DriftScore)
	assert.NotNil(t, decision.DriftReport)
}

func TestCheckAndRetrain_SkipsWhenDriftBelowThreshold(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.2},
	}
	orch := NewInMemoryOrchestrator()
	cfg := newTestConfig(true, 0.5)
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.False(t, decision.ShouldRetrain)
	assert.Nil(t, decision.Job)
	assert.Contains(t, decision.Reason, "within threshold")
}

func TestCheckAndRetrain_SkipsWhenDisabled(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.9},
	}
	orch := NewInMemoryOrchestrator()
	cfg := newTestConfig(false, 0.5)
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.False(t, decision.ShouldRetrain)
	assert.Contains(t, decision.Reason, "disabled")
}

func TestCheckAndRetrain_SkipsWhenCooldownNotElapsed(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.8},
	}
	orch := NewInMemoryOrchestrator()
	recent := time.Now().UTC()
	cfg := newTestConfig(true, 0.5)
	cfg.CooldownHours = 24
	cfg.LastRetrainAt = &recent
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.False(t, decision.ShouldRetrain)
	assert.Contains(t, decision.Reason, "cooldown")
}

func TestCheckAndRetrain_RetrainsWhenCooldownElapsed(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.8},
	}
	orch := NewInMemoryOrchestrator()
	old := time.Now().UTC().Add(-48 * time.Hour)
	cfg := newTestConfig(true, 0.5)
	cfg.CooldownHours = 24
	cfg.LastRetrainAt = &old
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.True(t, decision.ShouldRetrain)
	assert.NotNil(t, decision.Job)
}

func TestIsCooldownElapsed_TrueWhenNeverRetrained(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	cfg.CooldownHours = 24
	scheduler := NewRetrainScheduler(nil, nil, cfg)
	assert.True(t, scheduler.IsCooldownElapsed())
}

func TestIsCooldownElapsed_FalseWhenRecent(t *testing.T) {
	recent := time.Now().UTC()
	cfg := newTestConfig(true, 0.5)
	cfg.CooldownHours = 24
	cfg.LastRetrainAt = &recent
	scheduler := NewRetrainScheduler(nil, nil, cfg)
	assert.False(t, scheduler.IsCooldownElapsed())
}

func TestGetConfigAndUpdateConfig(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	scheduler := NewRetrainScheduler(nil, nil, cfg)

	got := scheduler.GetConfig()
	assert.Equal(t, 0.5, got.DriftThreshold)
	assert.True(t, got.Enabled)

	newCfg := newTestConfig(false, 0.9)
	scheduler.UpdateConfig(newCfg)
	got = scheduler.GetConfig()
	assert.Equal(t, 0.9, got.DriftThreshold)
	assert.False(t, got.Enabled)
}

func TestValidateScheduleConfig_Valid(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	require.NoError(t, ValidateScheduleConfig(cfg))
}

func TestValidateScheduleConfig_InvalidDriftThreshold(t *testing.T) {
	tests := []struct {
		name      string
		threshold float64
	}{
		{"negative", -0.1},
		{"above 1", 1.5},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := newTestConfig(true, tc.threshold)
			err := ValidateScheduleConfig(cfg)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "drift_threshold")
		})
	}
}

func TestValidateScheduleConfig_NegativeCooldown(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	cfg.CooldownHours = -1
	err := ValidateScheduleConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "cooldown_hours")
}

func TestValidateScheduleConfig_EmptyModelType(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	cfg.ModelType = ""
	err := ValidateScheduleConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "model_type")
}

func TestValidateScheduleConfig_InvalidFrequency(t *testing.T) {
	cfg := newTestConfig(true, 0.5)
	cfg.Frequency = "HOURLY"
	err := ValidateScheduleConfig(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "frequency")
}

func TestValidateScheduleConfig_AllFrequencies(t *testing.T) {
	for _, freq := range []ScheduleFrequency{
		ScheduleFrequencyDaily,
		ScheduleFrequencyWeekly,
		ScheduleFrequencyCustom,
	} {
		cfg := newTestConfig(true, 0.5)
		cfg.Frequency = freq
		require.NoError(t, ValidateScheduleConfig(cfg))
	}
}

func TestCheckAndRetrain_UpdatesLastRetrainAt(t *testing.T) {
	detector := &mockDriftDetector{
		report: &DriftReport{OverallDriftScore: 0.8},
	}
	orch := NewInMemoryOrchestrator()
	cfg := newTestConfig(true, 0.5)
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	assert.Nil(t, scheduler.GetConfig().LastRetrainAt)
	_, err := scheduler.CheckAndRetrain(context.Background(), "tenant-1")
	require.NoError(t, err)
	assert.NotNil(t, scheduler.GetConfig().LastRetrainAt)
}

func TestCheckAndRetrain_DetectorError(t *testing.T) {
	detector := &mockDriftDetector{
		err: assert.AnError,
	}
	orch := NewInMemoryOrchestrator()
	cfg := newTestConfig(true, 0.5)
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "t1")
	require.Error(t, err)
	assert.Nil(t, decision)
	assert.Contains(t, err.Error(), "drift detection failed")
}
