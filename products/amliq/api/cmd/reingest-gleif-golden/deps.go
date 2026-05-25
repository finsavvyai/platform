package main

import (
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

type deps struct {
	fetcher *ingestion.ListFetcher
	parser  *ingestion.GLEIFXMLParser
	repo    *pgx.EntityRepository
}

func newDeps(pool *pgx.Pool, timeout time.Duration) deps {
	return deps{
		fetcher: ingestion.NewListFetcher(timeout),
		parser:  ingestion.NewGLEIFXMLParser(),
		repo:    pgx.NewEntityRepository(pool.DB()),
	}
}

type runStats struct {
	entities int
	batches  int
	errors   int
}
