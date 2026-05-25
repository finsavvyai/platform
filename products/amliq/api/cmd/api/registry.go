package main

import (
	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/ingestion"
)

// buildRegistry creates the parser registry with all supported list types.
func buildRegistry() *ingestion.Registry {
	r := ingestion.NewRegistry()
	r.Register(domain.ListSourceOFAC, ingestion.NewOFACAdvancedParser())
	r.Register(domain.ListSourceEU, ingestion.NewEUParser())
	r.Register(domain.ListSourceUN, ingestion.NewUNParser())
	r.Register(domain.ListSourceUKOFSI, ingestion.NewUKOFSIParser())
	r.Register(domain.ListSourceSECO, ingestion.NewSECOParser())
	r.Register(domain.ListSourceIsraeliMoD, ingestion.NewNBCTFParser())
	r.Register(domain.ListSourceSDFM, ingestion.NewSDFMParser())
	r.Register(domain.ListSourceCustom, ingestion.NewCustomParser())
	r.Register(domain.ListSourceOpenSanctions, ingestion.NewOpenSanctionsNestedParser())
	r.Register(domain.ListSourceDFAT, ingestion.NewAuDFATParser())
	r.Register(domain.ListSourceCanada, ingestion.NewCanadaOSFIParser())
	r.Register(domain.ListSourceJapan, ingestion.NewJapanMOFParser())
	r.Register(domain.ListSourceMAS, ingestion.NewSingaporeMASParser())
	r.Register(domain.ListSourceKorea, ingestion.NewKoreaKOFIUParser())
	r.Register(domain.ListSourceUAE, ingestion.NewUAECBParser())
	r.Register(domain.ListSourceIndia, ingestion.NewIndiaRBIParser())
	r.Register(domain.ListSourceBrazil, ingestion.NewBrazilCOAFParser())
	r.Register(domain.ListSourceSouthAfrica, ingestion.NewSouthAfricaFICParser())
	return r
}
