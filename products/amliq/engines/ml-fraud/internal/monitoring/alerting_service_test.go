package monitoring

import (
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestNewNotificationManager(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	config := &NotificationConfig{
		Enabled: true,
	}

	manager := NewNotificationManager(logger, config)
	assert.NotNil(t, manager)
	assert.Equal(t, config, manager.config)
}

func TestNewAlertManager(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	config := &AlertingConfig{
		Enabled:            true,
		EvaluationInterval: 30 * time.Second,
	}

	// Mock dependencies
	redisClient := redis.NewClient(&redis.Options{})
	notiConfig := &NotificationConfig{Enabled: true}
	notifier := NewNotificationManager(logger, notiConfig)

	manager := NewAlertManager(redisClient, logger, config, notifier)

	assert.NotNil(t, manager)
	assert.Equal(t, config, manager.config)
	assert.NotNil(t, manager.rules)
	assert.NotNil(t, manager.activeAlerts)
}

func TestAlertManager_Start_Disabled(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	config := &AlertingConfig{
		Enabled: false,
	}

	// Mock dependencies
	redisClient := redis.NewClient(&redis.Options{})
	notiConfig := &NotificationConfig{Enabled: true}
	notifier := NewNotificationManager(logger, notiConfig)

	manager := NewAlertManager(redisClient, logger, config, notifier)

	err := manager.Start()
	assert.NoError(t, err)
}

func TestAlertManager_InitialRules(t *testing.T) {
	logger, _ := zap.NewDevelopment()
	config := &AlertingConfig{
		Enabled: true,
	}

	// Mock dependencies
	redisClient := redis.NewClient(&redis.Options{})
	notiConfig := &NotificationConfig{Enabled: true}
	notifier := NewNotificationManager(logger, notiConfig)

	manager := NewAlertManager(redisClient, logger, config, notifier)

	// In the real implementation, rules are loaded from Redis, which will fail or be empty here.
	// We just verify initialization.
	assert.NotNil(t, manager.GetRules())
}
