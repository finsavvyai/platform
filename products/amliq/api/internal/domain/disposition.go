package domain

import "fmt"

type Disposition int

const (
	DispositionUnknown Disposition = iota
	DispositionAutoClear
	DispositionReview
	DispositionAutoEscalate
)

func (d Disposition) String() string {
	switch d {
	case DispositionAutoClear:
		return "AutoClear"
	case DispositionReview:
		return "Review"
	case DispositionAutoEscalate:
		return "AutoEscalate"
	default:
		return "Unknown"
	}
}

type DispositionConfig struct {
	AutoClearBelow    float64
	ReviewBetween     [2]float64
	AutoEscalateAbove float64
}

func DispositionFromConfidence(conf Confidence, cfg DispositionConfig) Disposition {
	score := conf.Score()
	switch {
	case score < cfg.AutoClearBelow:
		return DispositionAutoClear
	case score > cfg.AutoEscalateAbove:
		return DispositionAutoEscalate
	default:
		return DispositionReview
	}
}

func ParseDisposition(s string) (Disposition, error) {
	switch s {
	case "AutoClear":
		return DispositionAutoClear, nil
	case "Review":
		return DispositionReview, nil
	case "AutoEscalate":
		return DispositionAutoEscalate, nil
	default:
		return DispositionUnknown, fmt.Errorf("invalid disposition: %s", s)
	}
}
