package ai

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/shopspring/decimal"
	"quantumbeam/internal/models"
)

// IntegrationExample demonstrates how to use the AI service for fraud detection
func IntegrationExample() {
	// Initialize AI service (in production, this would be configured with actual AI service URL)
	aiService := NewService("http://localhost:8001")

	// Create a sample transaction
	description := "Online purchase at electronics store - suspicious timing"
	deviceFingerprint := "fp_unknown_device_123"

	transaction := &models.TransactionData{
		TransactionID: "txn_example_001",
		Amount:        decimal.NewFromFloat(2500.00), // Large amount
		Timestamp:     time.Now(),
		MerchantID:    "merchant_electronics_store",
		UserID:        "user_john_doe",
		PaymentMethod: "credit_card",
		Description:   &description,
		Location: &models.GeoLocation{
			Latitude:  40.7128, // New York
			Longitude: -74.0060,
			Country:   "US",
			City:      "New York",
		},
		DeviceFingerprint: &deviceFingerprint,
		Features: map[string]float64{
			"velocity_1h":    3.0, // High velocity
			"velocity_24h":   8.0, // Very high velocity
			"amount_zscore":  2.5, // Amount is 2.5 standard deviations above normal
			"merchant_risk":  0.6, // Medium merchant risk
			"location_risk":  0.2, // Low location risk
			"device_risk":    0.9, // High device risk (unknown device)
			"behavior_score": 0.3, // Low behavior score (unusual for user)
			"time_risk":      0.8, // High time risk (unusual hour)
		},
	}

	ctx := context.Background()

	// Perform AI-enhanced fraud analysis
	log.Println("Performing AI-enhanced fraud analysis...")

	result, err := aiService.AnalyzeTransactionWithAI(ctx, transaction)
	if err != nil {
		log.Printf("AI analysis failed: %v", err)
		return
	}

	// Display results
	fmt.Printf("\n=== AI-Enhanced Fraud Detection Results ===\n")
	fmt.Printf("Transaction ID: %s\n", result.TransactionID)
	fmt.Printf("Fraud Score: %.3f\n", result.FraudScore)
	fmt.Printf("Risk Level: %s\n", result.RiskLevel)
	fmt.Printf("Confidence: %.1f%%\n", result.Confidence*100)
	fmt.Printf("Processing Time: %dms\n", result.ProcessingTimeMs)
	fmt.Printf("Processing Method: %s\n", result.ProcessingMethod)

	if result.AIAnalysis != nil {
		fmt.Printf("\n--- AI Analysis ---\n")
		fmt.Printf("AI Risk Level: %s\n", result.AIAnalysis.RiskLevel)
		fmt.Printf("AI Confidence: %.1f%%\n", result.AIAnalysis.Confidence*100)
		fmt.Printf("AI Provider: %s\n", result.AIAnalysis.Provider)
	}

	if result.TextAnalysis != nil {
		fmt.Printf("\n--- Text Analysis ---\n")
		fmt.Printf("Sentiment: %s\n", result.TextAnalysis.Sentiment)
		fmt.Printf("Text Confidence: %.1f%%\n", result.TextAnalysis.Confidence*100)
	}

	if result.AnomalyDetection != nil {
		fmt.Printf("\n--- Anomaly Detection ---\n")
		fmt.Printf("Anomaly Detected: %t\n", result.AnomalyDetection.AnomalyDetected)
		fmt.Printf("Feature Count: %d\n", result.AnomalyDetection.FeatureCount)
	}

	fmt.Printf("\n--- Confidence Factors ---\n")
	for i, factor := range result.ConfidenceFactors {
		fmt.Printf("%d. %s\n", i+1, factor)
	}

	fmt.Printf("\n--- AI Explanation ---\n")
	fmt.Printf("%s\n", result.Explanation)

	// Generate detailed explanation for different audiences
	fmt.Printf("\n=== Generating Detailed Explanations ===\n")

	// Technical explanation for fraud analysts
	technicalExplanation, err := aiService.GenerateFraudExplanation(ctx, result, transaction, "technical")
	if err != nil {
		log.Printf("Failed to generate technical explanation: %v", err)
	} else {
		fmt.Printf("\n--- Technical Explanation ---\n")
		fmt.Printf("Summary: %s\n", technicalExplanation.Summary)
		fmt.Printf("AI Insights: %s\n", technicalExplanation.AIInsights)
		fmt.Printf("Confidence Level: %s\n", technicalExplanation.ConfidenceLevel)

		if len(technicalExplanation.Recommendations) > 0 {
			fmt.Printf("Recommendations:\n")
			for _, rec := range technicalExplanation.Recommendations {
				if recMap, ok := rec.(map[string]interface{}); ok {
					fmt.Printf("- %s (Priority: %s): %s\n",
						recMap["action"], recMap["priority"], recMap["description"])
				}
			}
		}
	}

	// Business explanation for stakeholders
	businessExplanation, err := aiService.GenerateFraudExplanation(ctx, result, transaction, "business")
	if err != nil {
		log.Printf("Failed to generate business explanation: %v", err)
	} else {
		fmt.Printf("\n--- Business Explanation ---\n")
		fmt.Printf("Summary: %s\n", businessExplanation.Summary)
		fmt.Printf("AI Insights: %s\n", businessExplanation.AIInsights)
	}

	// Customer-friendly explanation
	customerExplanation, err := aiService.GenerateFraudExplanation(ctx, result, transaction, "customer")
	if err != nil {
		log.Printf("Failed to generate customer explanation: %v", err)
	} else {
		fmt.Printf("\n--- Customer Explanation ---\n")
		fmt.Printf("Summary: %s\n", customerExplanation.Summary)
		fmt.Printf("AI Insights: %s\n", customerExplanation.AIInsights)
	}

	// Display service health
	fmt.Printf("\n=== AI Service Health ===\n")
	health, err := aiService.GetServiceHealth(ctx)
	if err != nil {
		log.Printf("Failed to get service health: %v", err)
	} else {
		fmt.Printf("Service Status: %v\n", health["status"])
		fmt.Printf("Models Loaded: %v\n", health["models_loaded"])
		fmt.Printf("Providers Available: %v\n", health["providers_available"])
	}

	// Display cost analytics
	fmt.Printf("\n=== Cost Analytics ===\n")
	costStats, err := aiService.client.GetCostAnalytics(ctx)
	if err != nil {
		log.Printf("Failed to get cost analytics: %v", err)
	} else {
		if providers, ok := costStats["providers"].(map[string]interface{}); ok {
			for provider, stats := range providers {
				if providerStats, ok := stats.(map[string]interface{}); ok {
					if summary, ok := providerStats["summary"].(map[string]interface{}); ok {
						fmt.Printf("Provider %s: $%.4f total cost, %v requests\n",
							provider, summary["total_cost"], summary["total_requests"])
					}
				}
			}
		}
	}

	fmt.Printf("\n=== Integration Example Complete ===\n")
}

// DemoLowRiskTransaction demonstrates analysis of a low-risk transaction
func DemoLowRiskTransaction() {
	aiService := NewService("http://localhost:8001")

	description := "Regular coffee purchase"
	deviceFingerprint := "fp_known_device_456"

	transaction := &models.TransactionData{
		TransactionID: "txn_example_002",
		Amount:        decimal.NewFromFloat(4.50), // Small amount
		Timestamp:     time.Now(),
		MerchantID:    "merchant_coffee_shop",
		UserID:        "user_jane_smith",
		PaymentMethod: "credit_card",
		Description:   &description,
		Location: &models.GeoLocation{
			Latitude:  37.7749, // San Francisco (user's usual location)
			Longitude: -122.4194,
			Country:   "US",
			City:      "San Francisco",
		},
		DeviceFingerprint: &deviceFingerprint,
		Features: map[string]float64{
			"velocity_1h":    0.1,  // Low velocity
			"velocity_24h":   0.3,  // Low velocity
			"amount_zscore":  -0.2, // Amount below normal (small purchase)
			"merchant_risk":  0.1,  // Low merchant risk
			"location_risk":  0.0,  // No location risk (usual location)
			"device_risk":    0.1,  // Low device risk (known device)
			"behavior_score": 0.9,  // High behavior score (typical for user)
			"time_risk":      0.2,  // Low time risk (normal hour)
		},
	}

	ctx := context.Background()

	result, err := aiService.AnalyzeTransactionWithAI(ctx, transaction)
	if err != nil {
		log.Printf("AI analysis failed: %v", err)
		return
	}

	fmt.Printf("\n=== Low Risk Transaction Analysis ===\n")
	fmt.Printf("Transaction ID: %s\n", result.TransactionID)
	fmt.Printf("Fraud Score: %.3f\n", result.FraudScore)
	fmt.Printf("Risk Level: %s\n", result.RiskLevel)
	fmt.Printf("Confidence: %.1f%%\n", result.Confidence*100)
	fmt.Printf("Explanation: %s\n", result.Explanation)
}
