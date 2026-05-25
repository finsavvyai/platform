package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

type Plan struct {
	ID                          string
	Product                     Product
	Tier                        string
	Name                        string
	MonthlyPriceCents           int
	AnnualPriceCents            int
	Limits                      map[UsageMetric]int64
	Features                    []string
	LemonSqueezyVariantID       string
	LemonSqueezyVariantIDAnnual string
	CreatedAt                   time.Time
}

func NewPlan(id string, product Product, tier string, name string, monthlyPrice int) (Plan, error) {
	if id == "" || !product.IsValid() || name == "" {
		return Plan{}, fmt.Errorf("invalid plan parameters")
	}
	return Plan{
		ID:                          id,
		Product:                     product,
		Tier:                        tier,
		Name:                        name,
		MonthlyPriceCents:           monthlyPrice,
		AnnualPriceCents:            monthlyPrice * 12,
		Limits:                      make(map[UsageMetric]int64),
		Features:                    []string{},
		LemonSqueezyVariantID:       "",
		LemonSqueezyVariantIDAnnual: "",
		CreatedAt:                   time.Now().UTC(),
	}, nil
}

func (p Plan) MonthlyPriceUSD() float64 {
	return float64(p.MonthlyPriceCents) / 100.0
}

func (p Plan) AnnualPriceUSD() float64 {
	return float64(p.AnnualPriceCents) / 100.0
}

func (p Plan) GetLimit(metric UsageMetric) (int64, bool) {
	limit, ok := p.Limits[metric]
	return limit, ok
}

func (p *Plan) SetLimit(metric UsageMetric, limit int64) {
	p.Limits[metric] = limit
}

func (p *Plan) SetLemonSqueezyVariant(variantID, variantIDAnnual string) {
	p.LemonSqueezyVariantID = variantID
	p.LemonSqueezyVariantIDAnnual = variantIDAnnual
}

func (p Plan) MarshalJSON() ([]byte, error) {
	type Alias Plan
	return json.Marshal(&struct {
		*Alias
		MonthlyPriceUSD float64 `json:"monthly_price_usd"`
		AnnualPriceUSD  float64 `json:"annual_price_usd"`
	}{
		Alias:           (*Alias)(&p),
		MonthlyPriceUSD: p.MonthlyPriceUSD(),
		AnnualPriceUSD:  p.AnnualPriceUSD(),
	})
}
