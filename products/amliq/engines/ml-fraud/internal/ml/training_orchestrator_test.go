package ml

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTriggerRetrain_CreatesQueuedJob(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	job, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")

	require.NoError(t, err)
	assert.NotEmpty(t, job.ID)
	assert.Equal(t, "tenant-1", job.TenantID)
	assert.Equal(t, "fraud-score", job.ModelType)
	assert.Equal(t, JobStatusQueued, job.Status)
	assert.False(t, job.StartedAt.IsZero())
	assert.False(t, job.CreatedAt.IsZero())
	assert.Nil(t, job.CompletedAt)
	assert.Nil(t, job.Metrics)
	assert.Empty(t, job.Error)
}

func TestTriggerRetrain_RejectsWhenActiveJobExists(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	_, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	require.NoError(t, err)

	_, err = orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	assert.ErrorIs(t, err, ErrActiveJobExists)
}

func TestTriggerRetrain_AllowsDifferentModelTypes(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	_, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	require.NoError(t, err)

	job2, err := orch.TriggerRetrain(context.Background(), "tenant-1", "anomaly-detect")
	require.NoError(t, err)
	assert.Equal(t, "anomaly-detect", job2.ModelType)
}

func TestTriggerRetrain_AllowsDifferentTenants(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	_, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	require.NoError(t, err)

	job2, err := orch.TriggerRetrain(context.Background(), "tenant-2", "fraud-score")
	require.NoError(t, err)
	assert.Equal(t, "tenant-2", job2.TenantID)
}

func TestTriggerRetrain_ValidationErrors(t *testing.T) {
	orch := NewInMemoryOrchestrator()

	_, err := orch.TriggerRetrain(context.Background(), "", "fraud-score")
	assert.ErrorIs(t, err, ErrInvalidTenantID)

	_, err = orch.TriggerRetrain(context.Background(), "tenant-1", "")
	assert.ErrorIs(t, err, ErrInvalidModel)
}

func TestGetJobStatus_ReturnsCorrectJob(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	created, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	require.NoError(t, err)

	found, err := orch.GetJobStatus(context.Background(), "tenant-1", created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, found.ID)
	assert.Equal(t, JobStatusQueued, found.Status)
}

func TestGetJobStatus_ErrorForUnknownJob(t *testing.T) {
	orch := NewInMemoryOrchestrator()

	_, err := orch.GetJobStatus(context.Background(), "tenant-1", "nonexistent")
	assert.ErrorIs(t, err, ErrJobNotFound)
}

func TestGetJobStatus_IsolatesTenants(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	job, err := orch.TriggerRetrain(context.Background(), "tenant-1", "fraud-score")
	require.NoError(t, err)

	// Same job ID but wrong tenant should fail
	_, err = orch.GetJobStatus(context.Background(), "tenant-2", job.ID)
	assert.ErrorIs(t, err, ErrJobNotFound)
}

func TestListJobs_Pagination(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	ctx := context.Background()

	// Create 5 jobs across different model types to avoid active-job conflict
	models := []string{"m1", "m2", "m3", "m4", "m5"}
	for _, m := range models {
		_, err := orch.TriggerRetrain(ctx, "tenant-1", m)
		require.NoError(t, err)
	}

	// Page 1: limit 2, offset 0
	jobs, total, err := orch.ListJobs(ctx, "tenant-1", 2, 0)
	require.NoError(t, err)
	assert.Equal(t, 5, total)
	assert.Len(t, jobs, 2)

	// Page 2: limit 2, offset 2
	jobs, total, err = orch.ListJobs(ctx, "tenant-1", 2, 2)
	require.NoError(t, err)
	assert.Equal(t, 5, total)
	assert.Len(t, jobs, 2)

	// Page 3: limit 2, offset 4
	jobs, _, err = orch.ListJobs(ctx, "tenant-1", 2, 4)
	require.NoError(t, err)
	assert.Len(t, jobs, 1)

	// Beyond range
	jobs, _, err = orch.ListJobs(ctx, "tenant-1", 2, 10)
	require.NoError(t, err)
	assert.Empty(t, jobs)
}

func TestListJobs_FiltersByTenant(t *testing.T) {
	orch := NewInMemoryOrchestrator()
	ctx := context.Background()

	_, _ = orch.TriggerRetrain(ctx, "tenant-1", "fraud-score")
	_, _ = orch.TriggerRetrain(ctx, "tenant-2", "fraud-score")

	jobs, total, err := orch.ListJobs(ctx, "tenant-1", 10, 0)
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, jobs, 1)
	assert.Equal(t, "tenant-1", jobs[0].TenantID)
}

