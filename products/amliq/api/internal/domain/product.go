package domain

import "fmt"

type Product string

const (
	ProductAPI       Product = "api"
	ProductDashboard Product = "dashboard"
	ProductSDK       Product = "sdk"
	ProductIFrame    Product = "iframe"
	ProductDataset   Product = "dataset"
	ProductCrypto    Product = "crypto"
)

func (p Product) String() string {
	return string(p)
}

func (p Product) IsValid() bool {
	switch p {
	case ProductAPI, ProductDashboard, ProductSDK, ProductIFrame, ProductDataset, ProductCrypto:
		return true
	}
	return false
}

func (p Product) Description() string {
	switch p {
	case ProductAPI:
		return "Direct REST API integration with advanced security (mTLS, API keys, JWT)"
	case ProductDashboard:
		return "Cloud-hosted investigation workbench with analyst seats"
	case ProductSDK:
		return "Embed screening in your application via Go/Python/TypeScript SDK"
	case ProductIFrame:
		return "Embeddable screening widget for your website"
	case ProductDataset:
		return "Daily CSV export of sanctions data with delta updates"
	case ProductCrypto:
		return "Crypto wallet sanctions screening — 13K+ sanctioned addresses, sub-microsecond lookup"
	}
	return ""
}

func AllProducts() []Product {
	return []Product{ProductAPI, ProductDashboard, ProductSDK, ProductIFrame, ProductDataset, ProductCrypto}
}

func ParseProduct(s string) (Product, error) {
	p := Product(s)
	if !p.IsValid() {
		return "", fmt.Errorf("invalid product: %s", s)
	}
	return p, nil
}
