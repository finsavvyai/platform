package main

import (
	"net/http"
	"time"

	"github.com/aegis-aml/aegis/internal/ingestion"
	"github.com/aegis-aml/aegis/internal/storage/pgx"
)

type deps struct {
	http   *http.Client
	parser *ingestion.GLEIFParser
	repo   *pgx.EntityRepository
}

func newDeps(pool *pgx.Pool) deps {
	return deps{
		http:   &http.Client{Timeout: 60 * time.Second},
		parser: ingestion.NewGLEIFParser(),
		repo:   pgx.NewEntityRepository(pool.DB()),
	}
}

type runStats struct {
	pages    int
	entities int
	errors   int
}
