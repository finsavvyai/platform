package domain

import "testing"

func TestProductIsValid(t *testing.T) {
	tests := []struct {
		product Product
		want    bool
	}{
		{ProductAPI, true},
		{ProductDashboard, true},
		{ProductSDK, true},
		{ProductIFrame, true},
		{ProductDataset, true},
		{Product("invalid"), false},
	}
	for _, tt := range tests {
		if got := tt.product.IsValid(); got != tt.want {
			t.Errorf("Product(%s).IsValid() = %v, want %v", tt.product, got, tt.want)
		}
	}
}

func TestParseProduct(t *testing.T) {
	tests := []struct {
		input   string
		want    Product
		wantErr bool
	}{
		{"api", ProductAPI, false},
		{"dashboard", ProductDashboard, false},
		{"sdk", ProductSDK, false},
		{"iframe", ProductIFrame, false},
		{"dataset", ProductDataset, false},
		{"invalid", "", true},
	}
	for _, tt := range tests {
		got, err := ParseProduct(tt.input)
		if (err != nil) != tt.wantErr {
			t.Errorf("ParseProduct(%s) error = %v, wantErr %v", tt.input, err, tt.wantErr)
		}
		if got != tt.want {
			t.Errorf("ParseProduct(%s) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestProductDescription(t *testing.T) {
	for _, p := range AllProducts() {
		if p.Description() == "" {
			t.Errorf("Product(%s).Description() is empty", p)
		}
	}
}
