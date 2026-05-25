package main

import (
	"os"
	"time"

	"github.com/SDLC/llm-gateway/internal/config"
	"github.com/SDLC/llm-gateway/internal/storage"
	"github.com/SDLC/llm-gateway/internal/validation"
	"github.com/sirupsen/logrus"
)

// setupLogger configures the logger
func setupLogger(cfg config.LoggingConfig) *logrus.Logger {
	logger := logrus.New()
	level, err := logrus.ParseLevel(cfg.Level)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)
	if cfg.Format == "json" {
		logger.SetFormatter(&logrus.JSONFormatter{TimestampFormat: time.RFC3339})
	} else {
		logger.SetFormatter(&logrus.TextFormatter{FullTimestamp: true, TimestampFormat: time.RFC3339})
	}
	if cfg.Output == "file" {
		file, err := os.OpenFile("llm-gateway.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
		if err != nil {
			logger.SetOutput(os.Stdout)
		} else {
			logger.SetOutput(file)
		}
	} else {
		logger.SetOutput(os.Stdout)
	}
	return logger
}

// setupCostTracker creates a cost tracker
func setupCostTracker(cfg *config.Config, logger *logrus.Logger) storage.CostTracker {
	return &storage.MockCostTracker{}
}

// setupValidator creates a request validator
func setupValidator(cfg *config.Config, logger *logrus.Logger) validation.Validator {
	bannedModels := []string{}
	for _, provider := range cfg.LLM.Providers {
		for _, model := range provider.Models {
			if !model.Enabled {
				bannedModels = append(bannedModels, model.ID)
			}
		}
	}
	return validation.NewDefaultValidator(10000, 50, bannedModels)
}

// setupPromptDefender creates a prompt defender
func setupPromptDefender(cfg *config.Config, logger *logrus.Logger) validation.PromptDefender {
	defender := validation.NewDefaultPromptDefender()
	for _, pattern := range cfg.LLM.Security.BannedPatterns {
		if err := defender.AddBannedPattern(pattern); err != nil {
			logger.WithError(err).WithField("pattern", pattern).Warn("Failed to add banned pattern")
		}
	}
	return defender
}

// setupResponseSanitizer creates a response sanitizer
func setupResponseSanitizer(cfg *config.Config, logger *logrus.Logger) validation.ResponseSanitizer {
	return validation.NewDefaultResponseSanitizer(cfg.LLM.Security.MaxResponseLength)
}
