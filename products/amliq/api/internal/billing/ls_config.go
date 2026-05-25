package billing

import (
	"fmt"
	"os"
)

type LemonSqueezyConfig struct {
	StoreID       string
	APIKey        string
	WebhookSecret string
	ProductIDs    map[string]string
	VariantIDs    map[string]string
}

func LoadLemonSqueezyConfig() (*LemonSqueezyConfig, error) {
	cfg := &LemonSqueezyConfig{
		StoreID:       os.Getenv("LS_STORE_ID"),
		APIKey:        os.Getenv("LS_API_KEY"),
		WebhookSecret: os.Getenv("LS_WEBHOOK_SECRET"),
		ProductIDs:    make(map[string]string),
		VariantIDs:    make(map[string]string),
	}

	if cfg.StoreID == "" || cfg.APIKey == "" || cfg.WebhookSecret == "" {
		return nil, fmt.Errorf("missing required LemonSqueezy config")
	}

	cfg.ProductIDs["api"] = os.Getenv("LS_PRODUCT_API")
	cfg.ProductIDs["dashboard"] = os.Getenv("LS_PRODUCT_DASHBOARD")
	cfg.ProductIDs["sdk"] = os.Getenv("LS_PRODUCT_SDK")
	cfg.ProductIDs["iframe"] = os.Getenv("LS_PRODUCT_IFRAME")
	cfg.ProductIDs["dataset"] = os.Getenv("LS_PRODUCT_DATASET")

	return cfg, nil
}

func (c LemonSqueezyConfig) GetProductID(product string) (string, error) {
	id, ok := c.ProductIDs[product]
	if !ok || id == "" {
		return "", fmt.Errorf("missing LS product ID for %s", product)
	}
	return id, nil
}

func (c LemonSqueezyConfig) GetVariantID(planID string) (string, error) {
	id, ok := c.VariantIDs[planID]
	if !ok || id == "" {
		return "", fmt.Errorf("missing LS variant ID for plan %s", planID)
	}
	return id, nil
}
