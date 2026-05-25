package ingestion

// BulkDownloadSources lists sources that require manual download
// or special handling. The auto-sync handles everything else.
//
// These are loaded via:
//   1. Admin dashboard CSV upload (/admin/data-sources)
//   2. CLI: go run ./cmd/seed/ --icij --icij-dir /path/
//   3. Scheduled cloud function that downloads + uploads
//
// Sources that auto-sync (no manual action needed):
//   - OFAC SDN/Consolidated (treasury.gov, direct CSV)
//   - OpenSanctions default + PEPs (data.opensanctions.org)
//   - Wikidata PEPs + SOEs (SPARQL API)
//   - GLEIF LEI (API, 10K per session)
//
// Sources that need manual/scheduled download:
//   - ICIJ Offshore Leaks: offshoreleaks.icij.org (terms acceptance)
//   - GLEIF bulk: gleif.org (600MB ZIP, changes daily)
//   - UK Companies House PSC: download.companieshouse.gov.uk (300MB ZIP)
//
// Recommended: set up a Cloudflare Worker or GitHub Action that:
//   1. Downloads these files on a schedule (weekly)
//   2. Uploads to R2/S3 bucket
//   3. Calls POST /api/v1/admin/data-sources/upload
var ManualDownloadSources = []struct {
	Name        string
	URL         string
	Frequency   string
	EstRecords  int
	Instructions string
}{
	{
		Name:       "ICIJ Offshore Leaks",
		URL:        "https://offshoreleaks.icij.org/pages/database",
		Frequency:  "monthly",
		EstRecords: 800_000,
		Instructions: "Download ZIP, unzip, upload CSVs via admin dashboard",
	},
	{
		Name:       "GLEIF Golden Copy",
		URL:        "https://www.gleif.org/en/lei-data/gleif-golden-copy/download-the-concatenated-file",
		Frequency:  "weekly",
		EstRecords: 3_200_000,
		Instructions: "Download LEI-CDF CSV ZIP, upload via admin dashboard",
	},
	{
		Name:       "UK Companies House PSC",
		URL:        "https://download.companieshouse.gov.uk/en_pscdata.html",
		Frequency:  "monthly",
		EstRecords: 6_000_000,
		Instructions: "Download PSC snapshot ZIP, upload via admin dashboard",
	},
}
