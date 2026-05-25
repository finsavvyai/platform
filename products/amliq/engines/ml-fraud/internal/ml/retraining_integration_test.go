package ml

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// integrationDriftDetector returns a configurable DriftReport for integration tests.
type integrationDriftDetector struct {
	driftScore float64
}

func (m *integrationDriftDetector) Detect(_ context.Context, tenantID string, windowHours int) (*DriftReport, error) {
	rec := DriftRecommendationStable
	if m.driftScore > 0.3 {
		rec = DriftRecommendationRetrain
	}
	return &DriftReport{
		ID:                "dr-int-1",
		TenantID:          tenantID,
		Timestamp:         time.Now(),
		OverallDriftScore: m.driftScore,
		Recommendation:    rec,
		WindowHours:       windowHours,
		SampleCount:       500,
	}, nil
}

func TestIntegration_FullRetrainPipeline(t *testing.T) {
	detector := &integrationDriftDetector{driftScore: 0.8}
	orch := NewInMemoryOrchestrator()
	cfg := RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.5,
		CooldownHours:  0,
		Enabled:        true,
		ModelType:      "fraud_v2",
	}
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	ctx := context.Background()
	tenantID := "tenant-integration"

	// Step 1: Detect drift - should recommend retrain
	report, err := detector.Detect(ctx, tenantID, 24)
	require.NoError(t, err)
	assert.True(t, report.IsActionRequired())
	assert.Equal(t, 0.8, report.OverallDriftScore)

	// Step 2: Scheduler triggers retrain
	decision, err := scheduler.CheckAndRetrain(ctx, tenantID)
	require.NoError(t, err)
	assert.True(t, decision.ShouldRetrain)
	require.NotNil(t, decision.Job)
	jobID := decision.Job.ID

	// Step 3: Check job status
	job, err := orch.GetJobStatus(ctx, tenantID, jobID)
	require.NoError(t, err)
	assert.Equal(t, JobStatusQueued, job.Status)
	assert.Equal(t, "fraud_v2", job.ModelType)
	assert.Equal(t, tenantID, job.TenantID)

	// Step 4: List jobs confirms the job exists
	jobs, total, err := orch.ListJobs(ctx, tenantID, 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, jobs, 1)
	assert.Equal(t, jobID, jobs[0].ID)
}

func TestIntegration_ScheduledRetrainHighDrift(t *testing.T) {
	detector := &integrationDriftDetector{driftScore: 0.9}
	orch := NewInMemoryOrchestrator()
	cfg := RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.3,
		CooldownHours:  0,
		Enabled:        true,
		ModelType:      "fraud_v3",
	}
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "t-sched")
	require.NoError(t, err)
	assert.True(t, decision.ShouldRetrain)
	assert.Greater(t, decision.DriftScore, cfg.DriftThreshold)
	require.NotNil(t, decision.Job)
	assert.Equal(t, "fraud_v3", decision.Job.ModelType)
}

func TestIntegration_CooldownEnforcement(t *testing.T) {
	detector := &integrationDriftDetector{driftScore: 0.9}
	orch := NewInMemoryOrchestrator()

	// Set LastRetrainAt to now -- cooldown of 24h not elapsed.
	now := time.Now().UTC()
	cfg := RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.3,
		CooldownHours:  24,
		Enabled:        true,
		ModelType:      "fraud_v2",
		LastRetrainAt:  &now,
	}
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "t-cool")
	require.NoError(t, err)
	assert.False(t, decision.ShouldRetrain)
	assert.Contains(t, decision.Reason, "cooldown")
	assert.Nil(t, decision.Job)

	// Confirm no jobs were created
	jobs, total, err := orch.ListJobs(context.Background(), "t-cool", 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 0, total)
	assert.Empty(t, jobs)
}

func TestIntegration_ConcurrentRetrainPrevention(t *testing.T) {
	detector := &integrationDriftDetector{driftScore: 0.9}
	orch := NewInMemoryOrchestrator()
	tenantID := "t-concurrent"

	// First trigger succeeds
	job1, err := orch.TriggerRetrain(context.Background(), tenantID, "fraud_v2")
	require.NoError(t, err)
	require.NotNil(t, job1)

	// Second trigger for same tenant+model fails with ErrActiveJobExists
	var wg sync.WaitGroup
	errCh := make(chan error, 5)

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, triggerErr := orch.TriggerRetrain(context.Background(), tenantID, "fraud_v2")
			if triggerErr != nil {
				errCh <- triggerErr
			}
		}()
	}
	wg.Wait()
	close(errCh)

	// All concurrent attempts should have been rejected
	rejections := 0
	for triggerErr := range errCh {
		assert.ErrorIs(t, triggerErr, ErrActiveJobExists)
		rejections++
	}
	assert.Equal(t, 5, rejections)

	// Verify scheduler also gets rejected when active job exists
	cfg := RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.3,
		CooldownHours:  0,
		Enabled:        true,
		ModelType:      "fraud_v2",
	}
	scheduler := NewRetrainScheduler(detector, orch, cfg)
	_, schedErr := scheduler.CheckAndRetrain(context.Background(), tenantID)
	assert.Error(t, schedErr)
}

func TestIntegration_LowDriftSkipsRetrain(t *testing.T) {
	detector := &integrationDriftDetector{driftScore: 0.1}
	orch := NewInMemoryOrchestrator()
	cfg := RetrainScheduleConfig{
		Frequency:      ScheduleFrequencyDaily,
		DriftThreshold: 0.5,
		CooldownHours:  0,
		Enabled:        true,
		ModelType:      "fraud_v2",
	}
	scheduler := NewRetrainScheduler(detector, orch, cfg)

	decision, err := scheduler.CheckAndRetrain(context.Background(), "t-low")
	require.NoError(t, err)
	assert.False(t, decision.ShouldRetrain)
	assert.Contains(t, decision.Reason, "within threshold")
	assert.Nil(t, decision.Job)
}
