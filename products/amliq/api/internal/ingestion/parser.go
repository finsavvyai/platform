package ingestion

import (
	"github.com/aegis-aml/aegis/internal/domain"
)

type Parser interface {
	Parse(data []byte) ([]domain.Entity, error)
}

type ParserConfig struct {
	Source domain.ListSource
	Format string
}
