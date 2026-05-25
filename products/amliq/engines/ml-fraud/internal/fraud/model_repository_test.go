package fraud

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestModel(name, algo, version string) ModelVersion {
	return ModelVersion{
		Name:      name,
		Algorithm: algo,
		Version:   version,
		Metrics: ModelMetrics{
			Accuracy: 0.90, Precision: 0.88, Recall: 0.85,
			F1Score: 0.87, AUCROC: 0.93, ProcessingTimeMs: 25,
		},
	}
}

func TestModelRepository_CreateAndGet(t *testing.T) {
	repo := NewInMemoryModelRepository()
	model := newTestModel("GBM Detector", "gradient_boosting", "1.0.0")

	created, err := repo.CreateModel(model)
	require.NoError(t, err)
	assert.NotEmpty(t, created.ID)
	assert.Equal(t, ModelStatusInactive, created.Status)

	fetched, err := repo.GetModel(created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)
	assert.Equal(t, "GBM Detector", fetched.Name)
}

func TestModelRepository_CreateRequiresFields(t *testing.T) {
	repo := NewInMemoryModelRepository()
	_, err := repo.CreateModel(ModelVersion{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "required")
}

func TestModelRepository_GetNotFound(t *testing.T) {
	repo := NewInMemoryModelRepository()
	_, err := repo.GetModel("nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestModelRepository_ListWithPagination(t *testing.T) {
	repo := NewInMemoryModelRepository()
	for i := 0; i < 5; i++ {
		_, err := repo.CreateModel(newTestModel("Model", "algo", "1.0.0"))
		require.NoError(t, err)
	}

	models, total, err := repo.ListModels(0, 3, "")
	require.NoError(t, err)
	assert.Equal(t, 5, total)
	assert.Len(t, models, 3)

	models, total, err = repo.ListModels(3, 10, "")
	require.NoError(t, err)
	assert.Equal(t, 5, total)
	assert.Len(t, models, 2)
}

func TestModelRepository_ListWithStatusFilter(t *testing.T) {
	repo := NewInMemoryModelRepository()
	m1, _ := repo.CreateModel(newTestModel("Active", "algo", "1.0"))
	_, _ = repo.CreateModel(newTestModel("Inactive", "algo", "2.0"))
	_ = repo.UpdateModelStatus(m1.ID, ModelStatusActive)

	models, total, err := repo.ListModels(0, 10, "active")
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Len(t, models, 1)
	assert.Equal(t, ModelStatusActive, models[0].Status)
}

func TestModelRepository_ListOffsetBeyondTotal(t *testing.T) {
	repo := NewInMemoryModelRepository()
	_, _ = repo.CreateModel(newTestModel("M", "a", "1"))

	models, total, err := repo.ListModels(100, 10, "")
	require.NoError(t, err)
	assert.Equal(t, 1, total)
	assert.Empty(t, models)
}

func TestModelRepository_UpdateStatusActivation(t *testing.T) {
	repo := NewInMemoryModelRepository()
	m1, _ := repo.CreateModel(newTestModel("Model A", "algo", "1.0"))
	m2, _ := repo.CreateModel(newTestModel("Model B", "algo", "2.0"))

	// Activate first model
	err := repo.UpdateModelStatus(m1.ID, ModelStatusActive)
	require.NoError(t, err)
	active, _ := repo.GetActiveModel()
	assert.Equal(t, m1.ID, active.ID)

	// Activate second model -- first should be deactivated
	err = repo.UpdateModelStatus(m2.ID, ModelStatusActive)
	require.NoError(t, err)
	active, _ = repo.GetActiveModel()
	assert.Equal(t, m2.ID, active.ID)

	prev, _ := repo.GetModel(m1.ID)
	assert.Equal(t, ModelStatusInactive, prev.Status)
}

func TestModelRepository_UpdateStatusNotFound(t *testing.T) {
	repo := NewInMemoryModelRepository()
	err := repo.UpdateModelStatus("nonexistent", ModelStatusActive)
	assert.Error(t, err)
}

func TestModelRepository_GetActiveModelNone(t *testing.T) {
	repo := NewInMemoryModelRepository()
	_, err := repo.GetActiveModel()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no active model")
}

func TestModelRepository_CompareModels(t *testing.T) {
	repo := NewInMemoryModelRepository()
	m1, _ := repo.CreateModel(ModelVersion{
		Name: "A", Algorithm: "algo", Version: "1",
		Metrics: ModelMetrics{F1Score: 0.90},
	})
	m2, _ := repo.CreateModel(ModelVersion{
		Name: "B", Algorithm: "algo", Version: "2",
		Metrics: ModelMetrics{F1Score: 0.85},
	})

	cmp, err := repo.CompareModels(m1.ID, m2.ID)
	require.NoError(t, err)
	assert.Equal(t, m1.ID, cmp.ModelA.ID)
	assert.Equal(t, m2.ID, cmp.ModelB.ID)
	assert.Contains(t, cmp.Summary, m1.ID)
}

func TestModelRepository_CompareModelsNotFound(t *testing.T) {
	repo := NewInMemoryModelRepository()
	m1, _ := repo.CreateModel(newTestModel("A", "a", "1"))

	_, err := repo.CompareModels(m1.ID, "nonexistent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "model B not found")
}
