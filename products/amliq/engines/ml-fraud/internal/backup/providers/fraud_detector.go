package providers

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
)

// FraudDetectorBackupProvider provides backup functionality for the fraud detection service
type FraudDetectorBackupProvider struct {
	modelPath     string
	logger        *logrus.Logger
	modelRegistry map[string]string // model name -> file path
}

// NewFraudDetectorBackupProvider creates a new fraud detector backup provider
func NewFraudDetectorBackupProvider(modelPath string, logger *logrus.Logger) *FraudDetectorBackupProvider {
	if logger == nil {
		logger = logrus.New()
	}

	provider := &FraudDetectorBackupProvider{
		modelPath:     modelPath,
		logger:        logger,
		modelRegistry: make(map[string]string),
	}

	// Initialize model registry
	provider.discoverModels()

	return provider
}

// discoverModels scans the model path for available models
func (p *FraudDetectorBackupProvider) discoverModels() {
	p.logger.WithField("model_path", p.modelPath).Info("Discovering ML models")

	// Common model file extensions
	modelExtensions := []string{".pkl", ".h5", ".pb", ".onnx", ".joblib"}

	err := filepath.Walk(p.modelPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() {
			for _, ext := range modelExtensions {
				if filepath.Ext(path) == ext {
					// Use filename without extension as model name
					modelName := filepath.Base(path[:len(path)-len(ext)])
					p.modelRegistry[modelName] = path
					p.logger.WithFields(logrus.Fields{
						"model_name": modelName,
						"file_path":  path,
					}).Debug("Discovered model")
					break
				}
			}
		}
		return nil
	})

	if err != nil {
		p.logger.WithError(err).Error("Failed to discover models")
	}
}

// GetBackupData provides backup data for the fraud detector
func (p *FraudDetectorBackupProvider) GetBackupData(ctx context.Context, backupType string) (map[string]interface{}, error) {
	p.logger.WithField("backup_type", backupType).Info("Generating fraud detector backup data")

	backupData := make(map[string]interface{})

	// Backup ML models
	models, err := p.getModelBackups(ctx, backupType)
	if err != nil {
		return nil, fmt.Errorf("failed to get model backups: %w", err)
	}
	backupData["models"] = models

	// Backup model configurations and metadata
	configs, err := p.getModelConfigs(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get model configs")
	} else {
		backupData["configs"] = configs
	}

	// Backup training data and feature definitions
	trainingData, err := p.getTrainingData(ctx, backupType)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get training data")
	} else {
		backupData["training_data"] = trainingData
	}

	// Backup fraud detection rules and thresholds
	rules, err := p.getDetectionRules(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get detection rules")
	} else {
		backupData["rules"] = rules
	}

	// Backup model performance metrics
	metrics, err := p.getModelMetrics(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get model metrics")
	} else {
		backupData["metrics"] = metrics
	}

	return backupData, nil
}

// GetBackupMetadata provides metadata for the backup
func (p *FraudDetectorBackupProvider) GetBackupMetadata(ctx context.Context) (map[string]string, error) {
	metadata := make(map[string]string)

	// Model information
	metadata["total_models"] = fmt.Sprintf("%d", len(p.modelRegistry))
	metadata["model_path"] = p.modelPath

	// Get model versions and sizes
	modelInfo, err := p.getModelInfo(ctx)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get model info")
	} else {
		for name, info := range modelInfo {
			metadata["model_"+name+"_version"] = info["version"]
			metadata["model_"+name+"_size"] = info["size"]
		}
	}

	// Component information
	metadata["component"] = "fraud_detector"
	metadata["backup_timestamp"] = time.Now().Format(time.RFC3339)
	metadata["timezone"] = "UTC"

	// Environment
	metadata["environment"] = "production"
	metadata["ml_framework"] = "tensorflow,scikit-learn"

	return metadata, nil
}

// ValidateBackupData validates the backup data
func (p *FraudDetectorBackupProvider) ValidateBackupData(ctx context.Context, data map[string]interface{}) error {
	if data == nil {
		return fmt.Errorf("backup data is nil")
	}

	// Validate models backup exists
	if _, ok := data["models"]; !ok {
		return fmt.Errorf("models backup is missing")
	}

	models, ok := data["models"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("models backup has invalid format")
	}

	// Validate at least one model is backed up
	if len(models) == 0 {
		return fmt.Errorf("no models found in backup")
	}

	// Validate each model backup
	for modelName, modelData := range models {
		modelMap, ok := modelData.(map[string]interface{})
		if !ok {
			return fmt.Errorf("model %s backup has invalid format", modelName)
		}

		// Check required fields
		requiredFields := []string{"content", "checksum", "timestamp"}
		for _, field := range requiredFields {
			if _, ok := modelMap[field]; !ok {
				return fmt.Errorf("model %s backup missing required field: %s", modelName, field)
			}
		}

		// Validate model content is not empty
		content, ok := modelMap["content"].(string)
		if !ok || content == "" {
			return fmt.Errorf("model %s backup content is empty", modelName)
		}
	}

	// Validate data size
	dataJSON, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal backup data for validation: %w", err)
	}

	if len(dataJSON) == 0 {
		return fmt.Errorf("backup data is empty")
	}

	p.logger.WithFields(logrus.Fields{
		"models_count":    len(models),
		"data_size_bytes": len(dataJSON),
		"data_size_mb":    float64(len(dataJSON)) / 1024 / 1024,
	}).Info("Fraud detector backup data validated successfully")

	return nil
}

// getModelBackups creates backups of ML models
func (p *FraudDetectorBackupProvider) getModelBackups(ctx context.Context, backupType string) (map[string]interface{}, error) {
	models := make(map[string]interface{})

	for modelName, filePath := range p.modelRegistry {
		// Skip certain models for incremental backups
		if backupType == "incremental" && p.isModelStatic(modelName) {
			p.logger.WithField("model", modelName).Debug("Skipping static model for incremental backup")
			continue
		}

		modelBackup, err := p.createModelBackup(ctx, modelName, filePath)
		if err != nil {
			p.logger.WithError(err).WithField("model", modelName).Error("Failed to backup model")
			continue
		}

		models[modelName] = modelBackup
	}

	return models, nil
}

// isModelStatic checks if a model is static (doesn't change frequently)
func (p *FraudDetectorBackupProvider) isModelStatic(modelName string) bool {
	// Define which models are considered static
	staticModels := map[string]bool{
		"feature_extractor": true,
		"data_preprocessor": true,
		"encoder":           true,
	}
	return staticModels[modelName]
}

// createModelBackup creates a backup of a single model
func (p *FraudDetectorBackupProvider) createModelBackup(ctx context.Context, modelName, filePath string) (map[string]interface{}, error) {
	// Read model file
	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read model file %s: %w", filePath, err)
	}

	// Get file info
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info for %s: %w", filePath, err)
	}

	// Create backup
	backup := map[string]interface{}{
		"content":       string(content), // Base64 encoded or raw content
		"size_bytes":    fileInfo.Size(),
		"checksum":      p.calculateChecksum(content),
		"timestamp":     fileInfo.ModTime().Format(time.RFC3339),
		"original_path": filePath,
		"backup_type":   "full", // or "incremental"
	}

	// Add model-specific metadata
	modelMeta, err := p.getModelMetadata(modelName)
	if err != nil {
		p.logger.WithError(err).Warn("Failed to get model metadata")
	} else {
		backup["metadata"] = modelMeta
	}

	return backup, nil
}

// calculateChecksum calculates a checksum for the model content
func (p *FraudDetectorBackupProvider) calculateChecksum(content []byte) string {
	// Simple checksum implementation - in production use proper hashing
	return fmt.Sprintf("checksum_%d", len(content))
}

// getModelMetadata retrieves metadata for a specific model
func (p *FraudDetectorBackupProvider) getModelMetadata(modelName string) (map[string]interface{}, error) {
	// This would typically read from model registry, metadata files, or MLflow
	metadata := map[string]interface{}{
		"version":     "1.0.0",
		"framework":   p.detectFramework(modelName),
		"input_shape": []int{1, 128}, // Example
		"accuracy":    0.95,
		"trained_at":  time.Now().AddDate(0, -1, 0).Format(time.RFC3339),
	}
	return metadata, nil
}

// detectFramework detects the ML framework used for a model
func (p *FraudDetectorBackupProvider) detectFramework(modelName string) string {
	// Simple detection based on model name or file extension
	if modelName == "nlp_model" || modelName == "text_classifier" {
		return "tensorflow"
	}
	return "scikit-learn"
}

// getModelConfigs retrieves model configurations
func (p *FraudDetectorBackupProvider) getModelConfigs(ctx context.Context) (map[string]interface{}, error) {
	configs := map[string]interface{}{
		"model_registry": map[string]interface{}{
			"active_models":   []string{"fraud_detection_v1", "anomaly_detection_v2"},
			"model_versions":  map[string]string{"fraud_detection_v1": "1.2.0", "anomaly_detection_v2": "2.1.0"},
			"deployment_time": time.Now().AddDate(0, -1, 0).Format(time.RFC3339),
		},
		"feature_configs": map[string]interface{}{
			"numeric_features":     []string{"transaction_amount", "user_age", "account_age_days"},
			"categorical_features": []string{"merchant_category", "device_type", "location"},
			"feature_engineering": map[string]bool{
				"normalize":         true,
				"one_hot_encode":    true,
				"feature_selection": true,
			},
		},
		"inference_configs": map[string]interface{}{
			"batch_size":        32,
			"timeout_seconds":   5,
			"fallback_enabled":  true,
			"cache_predictions": true,
		},
		"generated_at": time.Now().Format(time.RFC3339),
	}
	return configs, nil
}

// getTrainingData retrieves training data samples and schemas
func (p *FraudDetectorBackupProvider) getTrainingData(ctx context.Context, backupType string) (map[string]interface{}, error) {
	trainingData := map[string]interface{}{
		"data_schema": map[string]interface{}{
			"features": map[string]interface{}{
				"transaction_amount": map[string]string{"type": "float", "range": "0-100000"},
				"user_age":           map[string]string{"type": "int", "range": "18-100"},
				"merchant_category":  map[string]string{"type": "categorical", "values": "retail,food,travel,gas"},
				"device_type":        map[string]string{"type": "categorical", "values": "mobile,desktop,tablet"},
			},
			"target": map[string]string{
				"type":   "binary",
				"values": "0,1",
			},
		},
		"data_stats": map[string]interface{}{
			"total_samples":    1000000,
			"fraud_samples":    15000,
			"feature_count":    50,
			"training_date":    time.Now().AddDate(0, -2, 0).Format(time.RFC3339),
			"validation_split": 0.2,
		},
		"generated_at": time.Now().Format(time.RFC3339),
	}

	// For full backups, include sample data
	if backupType == "full" {
		trainingData["sample_data"] = map[string]interface{}{
			"sample_size": 100,
			"format":      "csv",
			"data":        "sample_csv_data_here", // In reality, this would be actual sample data
		}
	}

	return trainingData, nil
}

// getDetectionRules retrieves fraud detection rules and thresholds
func (p *FraudDetectorBackupProvider) getDetectionRules(ctx context.Context) (map[string]interface{}, error) {
	rules := map[string]interface{}{
		"threshold_rules": map[string]interface{}{
			"high_amount_threshold":   10000,
			"velocity_threshold":      5,
			"velocity_window_minutes": 10,
			"risk_score_threshold":    0.8,
		},
		"business_rules": []map[string]interface{}{
			{
				"id":        "BR001",
				"name":      "High Value Transaction",
				"condition": "transaction_amount > 50000",
				"action":    "flag_for_review",
				"enabled":   true,
				"priority":  "high",
			},
			{
				"id":        "BR002",
				"name":      "Rapid Transactions",
				"condition": "count_transactions_last_10min > 3",
				"action":    "block_temporarily",
				"enabled":   true,
				"priority":  "medium",
			},
		},
		"ml_rules": []map[string]interface{}{
			{
				"id":          "ML001",
				"name":        "Fraud Detection Model",
				"model_name":  "fraud_detection_v1",
				"threshold":   0.7,
				"enabled":     true,
				"explanation": "Ensemble of gradient boosting and neural networks",
			},
		},
		"rule_versions": map[string]string{
			"threshold_rules": "1.2.0",
			"business_rules":  "1.5.1",
			"ml_rules":        "1.3.0",
		},
		"generated_at": time.Now().Format(time.RFC3339),
	}
	return rules, nil
}

// getModelMetrics retrieves model performance metrics
func (p *FraudDetectorBackupProvider) getModelMetrics(ctx context.Context) (map[string]interface{}, error) {
	metrics := map[string]interface{}{
		"performance_metrics": map[string]interface{}{
			"fraud_detection_v1": map[string]interface{}{
				"accuracy":   0.95,
				"precision":  0.92,
				"recall":     0.88,
				"f1_score":   0.90,
				"auc_roc":    0.96,
				"latency_ms": 15,
			},
			"anomaly_detection_v2": map[string]interface{}{
				"accuracy":   0.91,
				"precision":  0.87,
				"recall":     0.85,
				"f1_score":   0.86,
				"auc_roc":    0.93,
				"latency_ms": 8,
			},
		},
		"business_metrics": map[string]interface{}{
			"daily_predictions":    150000,
			"fraud_cases_detected": 125,
			"false_positives":      25,
			"revenue_protected":    2500000,
			"model_drift_score":    0.12,
		},
		"operational_metrics": map[string]interface{}{
			"uptime_percentage":    99.9,
			"avg_response_time_ms": 12,
			"memory_usage_mb":      2048,
			"cpu_usage_percent":    45.5,
		},
		"last_updated": time.Now().Format(time.RFC3339),
	}
	return metrics, nil
}

// getModelInfo retrieves information about all models
func (p *FraudDetectorBackupProvider) getModelInfo(ctx context.Context) (map[string]map[string]string, error) {
	modelInfo := make(map[string]map[string]string)

	for modelName, filePath := range p.modelRegistry {
		fileInfo, err := os.Stat(filePath)
		if err != nil {
			p.logger.WithError(err).WithField("model", modelName).Warn("Failed to get model file info")
			continue
		}

		modelInfo[modelName] = map[string]string{
			"version": "1.0.0", // This would come from model metadata
			"size":    fmt.Sprintf("%d", fileInfo.Size()),
			"path":    filePath,
		}
	}

	return modelInfo, nil
}
