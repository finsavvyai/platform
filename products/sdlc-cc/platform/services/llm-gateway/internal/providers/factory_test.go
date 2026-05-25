package providers

import (
	"context"
	"testing"

	"github.com/SDLC/llm-gateway/pkg/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewFactory_Empty(t *testing.T) {
	f := NewFactory(nil)
	require.NotNil(t, f)

	_, err := f.GetProvider("openai")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "provider not found")

	list := f.GetProvidersByPriority()
	assert.Empty(t, list)

	all := f.GetAllProviders()
	assert.Empty(t, all)
}

func TestFactory_WithOllamaProvider(t *testing.T) {
	configs := []models.ProviderConfig{
		{
			Name:    "ollama",
			Type:    "ollama",
			APIKey:  "",
			BaseURL: "http://localhost:11434/v1",
			Models:  []models.ModelConfig{{ID: "llama2", Name: "Llama 2", Enabled: true}},
			Enabled: true,
			Priority: 1,
		},
	}
	f := NewFactory(configs)
	require.NotNil(t, f)

	p, err := f.GetProvider("ollama")
	require.NoError(t, err)
	require.NotNil(t, p)
	assert.Equal(t, "ollama", p.GetName())
	assert.True(t, p.IsEnabled())

	list := f.GetProvidersByPriority()
	require.Len(t, list, 1)
	assert.Equal(t, "ollama", list[0].GetName())

	_, err = f.GetProviderForModel("llama2")
	require.NoError(t, err)

	modelsOut, err := f.GetAvailableModels()
	require.NoError(t, err)
	assert.NotEmpty(t, modelsOut)
}

func TestFactory_GetProvider_Disabled(t *testing.T) {
	configs := []models.ProviderConfig{
		{Name: "ollama", Type: "ollama", Enabled: false, Priority: 1},
	}
	f := NewFactory(configs)
	_, err := f.GetProvider("ollama")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "disabled")
}

func TestFactory_AddProvider(t *testing.T) {
	f := NewFactory(nil)

	err := f.AddProvider(models.ProviderConfig{
		Name: "ollama", Type: "ollama", Enabled: true,
	})
	require.NoError(t, err)

	p, err := f.GetProvider("ollama")
	require.NoError(t, err)
	assert.Equal(t, "ollama", p.GetName())

	err = f.AddProvider(models.ProviderConfig{Name: "ollama", Type: "ollama"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")

	err = f.AddProvider(models.ProviderConfig{Name: "x", Type: "unknown"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown provider type")
}

func TestFactory_RemoveProvider(t *testing.T) {
	configs := []models.ProviderConfig{
		{Name: "ollama", Type: "ollama", Enabled: true},
	}
	f := NewFactory(configs)

	err := f.RemoveProvider("nonexistent")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "provider not found")

	require.NoError(t, f.RemoveProvider("ollama"))
	_, err = f.GetProvider("ollama")
	require.Error(t, err)
}

func TestFactory_CheckAllHealth(t *testing.T) {
	f := NewFactory([]models.ProviderConfig{
		{Name: "ollama", Type: "ollama", Enabled: true},
	})
	ctx := context.Background()
	results := f.CheckAllHealth(ctx)
	require.Len(t, results, 1)
	// Health may be healthy or error depending on whether ollama is running
	assert.Contains(t, results, "ollama")
}
