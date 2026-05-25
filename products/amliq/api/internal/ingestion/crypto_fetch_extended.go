package ingestion

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

var cryptoHTTP = &http.Client{Timeout: 60 * time.Second}

// FetchChainalysisSanctions queries the Chainalysis free sanctions API.
// Returns addresses across all chains that Chainalysis has flagged.
func FetchChainalysisSanctions(src CryptoSource) ([]domain.CryptoEntry, error) {
	// The public API requires querying per-address; the bulk list is
	// published as a newline-delimited text at a known endpoint.
	// Fall back to line-scan fetcher for the public list endpoint.
	return FetchCryptoAddresses(src)
}

// FetchOpenSanctionsCrypto extracts CryptoWallet entities from the
// OpenSanctions FtM JSON-lines feed. Filters by schema=CryptoWallet.
func FetchOpenSanctionsCrypto(src CryptoSource) ([]domain.CryptoEntry, error) {
	resp, err := cryptoHTTP.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}

	var entries []domain.CryptoEntry
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1<<20), 8<<20)
	for scanner.Scan() {
		line := scanner.Bytes()
		var row struct {
			Schema     string              `json:"schema"`
			Properties map[string][]string `json:"properties"`
			Datasets   []string            `json:"datasets"`
		}
		if json.Unmarshal(line, &row) != nil {
			continue
		}
		if row.Schema != "CryptoWallet" {
			continue
		}
		addrs := row.Properties["publicKey"]
		if len(addrs) == 0 {
			addrs = row.Properties["address"]
		}
		chain := "MULTI"
		if chains := row.Properties["currency"]; len(chains) > 0 {
			chain = strings.ToUpper(chains[0])
		}
		for _, addr := range addrs {
			if addr = strings.TrimSpace(addr); addr != "" {
				entries = append(entries, domain.CryptoEntry{
					Address: addr, Chain: chain,
					ListID: src.ID, Source: src.Name,
				})
			}
		}
	}
	return entries, scanner.Err()
}

// FetchEUCrypto extracts crypto addresses from the EU FSF CSV.
// Looks for "CryptoWalletAddress" in identification type columns.
func FetchEUCrypto(src CryptoSource) ([]domain.CryptoEntry, error) {
	resp, err := cryptoHTTP.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}

	reader := csv.NewReader(resp.Body)
	reader.Comma = ';'
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	hdr := buildHeaderIndex(header)

	var entries []domain.CryptoEntry
	for {
		rec, err := reader.Read()
		if err != nil {
			break
		}
		idType := strings.TrimSpace(hdr.get(rec, "Identification_type"))
		if !strings.Contains(strings.ToLower(idType), "crypto") &&
			!strings.Contains(strings.ToLower(idType), "digital") &&
			!strings.Contains(strings.ToLower(idType), "wallet") {
			continue
		}
		addr := strings.TrimSpace(hdr.get(rec, "Identification_value"))
		if addr == "" {
			addr = strings.TrimSpace(hdr.get(rec, "Identification_number"))
		}
		if addr == "" {
			continue
		}
		entries = append(entries, domain.CryptoEntry{
			Address: addr, Chain: "MULTI",
			ListID: src.ID, Source: src.Name,
		})
	}
	return entries, nil
}

// FetchUKOFSICrypto extracts crypto addresses from UK OFSI ConList CSV.
// Scans "Other Information" and "Additional Information" for wallet patterns.
func FetchUKOFSICrypto(src CryptoSource) ([]domain.CryptoEntry, error) {
	resp, err := cryptoHTTP.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}

	reader := csv.NewReader(resp.Body)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	hdr := buildHeaderIndex(header)

	var entries []domain.CryptoEntry
	for {
		rec, err := reader.Read()
		if err != nil {
			break
		}
		// Check multiple info columns for wallet-like strings
		for _, col := range []string{
			"Other Information", "Additional Information",
			"Group ID", "Entity Type",
		} {
			val := hdr.get(rec, col)
			addrs := extractWalletAddresses(val)
			for _, addr := range addrs {
				entries = append(entries, domain.CryptoEntry{
					Address: addr, Chain: "MULTI",
					ListID: src.ID, Source: src.Name,
				})
			}
		}
	}
	return entries, nil
}

// FetchBitcoinAbuse fetches reported abusive BTC addresses.
func FetchBitcoinAbuse(src CryptoSource) ([]domain.CryptoEntry, error) {
	resp, err := cryptoHTTP.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		// API may require key — fall back gracefully
		return nil, fmt.Errorf("fetch %s: HTTP %d (may need API key)", src.ID, resp.StatusCode)
	}

	var rows []struct {
		Address string `json:"address"`
		Count   int    `json:"count"`
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 50<<20))
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, fmt.Errorf("parse %s: %w", src.ID, err)
	}

	entries := make([]domain.CryptoEntry, 0, len(rows))
	for _, r := range rows {
		if r.Address == "" || r.Count < 3 {
			continue // Only include addresses with 3+ reports
		}
		entries = append(entries, domain.CryptoEntry{
			Address: r.Address, Chain: "BTC",
			ListID: src.ID, Source: src.Name,
		})
	}
	return entries, nil
}

// FetchEllipticSanctions parses the Elliptic open CSV dataset.
func FetchEllipticSanctions(src CryptoSource) ([]domain.CryptoEntry, error) {
	resp, err := cryptoHTTP.Get(src.URL)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", src.ID, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("fetch %s: HTTP %d", src.ID, resp.StatusCode)
	}

	reader := csv.NewReader(resp.Body)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}
	hdr := buildHeaderIndex(header)

	var entries []domain.CryptoEntry
	for {
		rec, err := reader.Read()
		if err != nil {
			break
		}
		addr := strings.TrimSpace(hdr.get(rec, "address"))
		if addr == "" {
			continue
		}
		chain := strings.ToUpper(strings.TrimSpace(hdr.get(rec, "chain")))
		if chain == "" {
			chain = "MULTI"
		}
		entries = append(entries, domain.CryptoEntry{
			Address: addr, Chain: chain,
			ListID: src.ID, Source: src.Name,
		})
	}
	return entries, nil
}

// extractWalletAddresses finds crypto wallet patterns in free text.
// Matches BTC (1/3/bc1), ETH (0x), and common altcoin patterns.
func extractWalletAddresses(text string) []string {
	if text == "" {
		return nil
	}
	var addrs []string
	for _, word := range strings.Fields(text) {
		word = strings.Trim(word, ".,;:()[]\"'")
		if looksLikeWallet(word) {
			addrs = append(addrs, word)
		}
	}
	return addrs
}

func looksLikeWallet(s string) bool {
	if len(s) < 26 {
		return false
	}
	// BTC: starts with 1, 3, or bc1
	if (s[0] == '1' || s[0] == '3') && len(s) >= 26 && len(s) <= 35 {
		return isAlphaNumeric(s)
	}
	if strings.HasPrefix(s, "bc1") && len(s) >= 42 {
		return isAlphaNumeric(s)
	}
	// ETH/EVM: 0x + 40 hex chars
	if strings.HasPrefix(s, "0x") && len(s) == 42 {
		return isHex(s[2:])
	}
	// TRX: starts with T, 34 chars
	if s[0] == 'T' && len(s) == 34 {
		return isAlphaNumeric(s)
	}
	return false
}

func isAlphaNumeric(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
			return false
		}
	}
	return true
}

func isHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
