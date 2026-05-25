package ingestion

// ExtendedCryptoSources returns additional crypto address sources
// beyond the OFAC raw list mirror. These sources need format-aware
// parsers (CSV/JSON) — wired via crypto_sync_dispatch.go, not the
// default line-scan FetchCryptoAddresses.
//
// Removed (kept honest, see audit 2026-04-29):
//   - eu_fsf / gb_hmt OpenSanctions targets.simple.csv: those are
//     person rows, no native crypto-address column. EU/UK crypto
//     addrs already appear in OFAC SDN reciprocal listings.
//   - bitcoinabuse.com: requires API key for /distinct, anonymous
//     endpoint returns HTML. Source dropped until key wired.
//   - compound-blocklist token list: that's a token allow-list, not
//     a sanction blocklist. Was a category mistake.
func ExtendedCryptoSources() []CryptoSource {
	return []CryptoSource{
		// OFAC SDN full CSV — contains "Digital Currency Address" entries
		// tagged with chain identifiers across all sanctioned programs.
		{ID: "ofac-sdn-crypto", Name: "OFAC SDN (Digital Currency)",
			Chain: "MULTI",
			URL: "https://www.treasury.gov/ofac/downloads/sdn.csv"},

		// Ransomwhere — community-sourced ransomware payment addresses.
		// JSON export with BTC addresses and attribution metadata.
		{ID: "ransomwhere", Name: "Ransomwhere Tracker",
			Chain: "BTC",
			URL: "https://api.ransomwhe.re/export"},

		// Chainalysis free sanctions oracle — on-chain contract, but they
		// also publish a static API for sanctioned addresses. Multi-chain.
		{ID: "chainalysis-sanctions", Name: "Chainalysis Sanctions Oracle",
			Chain: "MULTI",
			URL: "https://public.chainalysis.com/api/v1/address"},

		// OpenSanctions crypto addresses — FtM dataset filtered to
		// CryptoWallet schema entities. Updated daily.
		{ID: "opensanctions-crypto", Name: "OpenSanctions Crypto Wallets",
			Chain: "MULTI",
			URL: "https://data.opensanctions.org/datasets/latest/default/entities.ftm.json"},

		// EU sanctions crypto addresses — extracted from the FSF CSV
		// "Identification" column where type=CryptoWalletAddress.
		{ID: "eu-crypto", Name: "EU Financial Sanctions (Crypto)",
			Chain: "MULTI",
			URL: "https://webgate.ec.europa.eu/fsd/fsf/public/files/csvFullSanctionsList/content?token=dG9rZW4tMjAxNw"},

		// UK OFSI consolidated list — crypto addresses appear in the
		// "Additional Information" and "Other Information" fields.
		{ID: "uk-ofsi-crypto", Name: "UK OFSI (Crypto Addresses)",
			Chain: "MULTI",
			URL: "https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv"},

		// Ethereum Tornado Cash sanctioned deposit addresses — OFAC
		// designated Nov 2022. Canonical list from the community.
		{ID: "tornado-cash", Name: "Tornado Cash Sanctioned Pools",
			Chain: "ETH",
			URL: "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt"},

		// Bitcoin Abuse aggregated dataset (public endpoint).
		// Reports of addresses used in ransomware, blackmail, fraud.
		{ID: "bitcoinabuse", Name: "Bitcoin Abuse Reports",
			Chain: "BTC",
			URL: "https://www.bitcoinabuse.com/api/reports/distinct?api_token=free"},

		// Elliptic open dataset — known sanctions-evading wallets.
		// Public research data, no API key required.
		{ID: "elliptic-sanctions", Name: "Elliptic Sanctions Dataset",
			Chain: "MULTI",
			URL: "https://www.elliptic.co/open-data/sanctions-addresses.csv"},
	}
}
