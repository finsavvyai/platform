package fraud

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupABTestEnv(t *testing.T) (*InMemoryABTestService, *ModelVersion, *ModelVersion) {
	t.Helper()
	repo := NewInMemoryModelRepository()
	svc := NewInMemoryABTestService(repo)

	mA, err := repo.CreateModel(ModelVersion{
		Name: "Model A", Algorithm: "gbm", Version: "1.0",
		Metrics: ModelMetrics{F1Score: 0.90, Accuracy: 0.92},
	})
	require.NoError(t, err)

	mB, err := repo.CreateModel(ModelVersion{
		Name: "Model B", Algorithm: "quantum", Version: "2.0",
		Metrics: ModelMetrics{F1Score: 0.85, Accuracy: 0.88},
	})
	require.NoError(t, err)

	return svc, mA, mB
}

func TestABTestService_CreateAndGet(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	test, err := svc.CreateABTest(ABTestConfig{
		Name: "GBM vs Quantum", ModelAID: mA.ID, ModelBID: mB.ID,
		TrafficSplit: 70,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, test.ID)
	assert.Equal(t, ABTestStatusRunning, test.Status)

	fetched, err := svc.GetABTest(test.ID)
	require.NoError(t, err)
	assert.Equal(t, test.ID, fetched.ID)
}

func TestABTestService_CreateValidation(t *testing.T) {
	svc, mA, _ := setupABTestEnv(t)

	// Invalid split
	_, err := svc.CreateABTest(ABTestConfig{
		Name: "Bad", ModelAID: mA.ID, ModelBID: mA.ID, TrafficSplit: 50,
	})
	assert.Error(t, err)

	// Nonexistent model
	_, err = svc.CreateABTest(ABTestConfig{
		Name: "Bad", ModelAID: mA.ID, ModelBID: "ghost", TrafficSplit: 50,
	})
	assert.Error(t, err)
}

func TestABTestService_ConcurrentTestPrevention(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	_, err := svc.CreateABTest(ABTestConfig{
		Name: "Test 1", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 50,
	})
	require.NoError(t, err)

	_, err = svc.CreateABTest(ABTestConfig{
		Name: "Test 2", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 60,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already running")
}

func TestABTestService_StopTest(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	test, _ := svc.CreateABTest(ABTestConfig{
		Name: "Test", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 50,
	})

	result, err := svc.StopABTest(test.ID)
	require.NoError(t, err)
	assert.Equal(t, test.ID, result.TestID)
	assert.Equal(t, mA.ID, result.Winner) // Model A has higher F1
	assert.Greater(t, result.Confidence, 0.0)

	// Test should now be completed
	fetched, _ := svc.GetABTest(test.ID)
	assert.Equal(t, ABTestStatusCompleted, fetched.Status)
	assert.NotNil(t, fetched.EndedAt)
}

func TestABTestService_StopNonRunningTest(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	test, _ := svc.CreateABTest(ABTestConfig{
		Name: "Test", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 50,
	})
	_, _ = svc.StopABTest(test.ID)

	_, err := svc.StopABTest(test.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not running")
}

func TestABTestService_StopNotFound(t *testing.T) {
	svc, _, _ := setupABTestEnv(t)
	_, err := svc.StopABTest("nonexistent")
	assert.Error(t, err)
}

func TestABTestService_GetActiveTest(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	// No active test initially
	_, err := svc.GetActiveABTest()
	assert.Error(t, err)

	test, _ := svc.CreateABTest(ABTestConfig{
		Name: "Test", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 50,
	})

	active, err := svc.GetActiveABTest()
	require.NoError(t, err)
	assert.Equal(t, test.ID, active.ID)
}

func TestABTestService_GetTrafficSplit(t *testing.T) {
	svc, mA, mB := setupABTestEnv(t)

	// No active test
	_, _, _, err := svc.GetTrafficSplit()
	assert.Error(t, err)

	_, _ = svc.CreateABTest(ABTestConfig{
		Name: "Test", ModelAID: mA.ID, ModelBID: mB.ID, TrafficSplit: 70,
	})

	aID, bID, split, err := svc.GetTrafficSplit()
	require.NoError(t, err)
	assert.Equal(t, mA.ID, aID)
	assert.Equal(t, mB.ID, bID)
	assert.Equal(t, 70, split)
}

func TestABTestService_GetTestNotFound(t *testing.T) {
	svc, _, _ := setupABTestEnv(t)
	_, err := svc.GetABTest("nonexistent")
	assert.Error(t, err)
}
