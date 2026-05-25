package ingestion

import (
	"fmt"
	"log"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

const (
	nbctfBlockchainURL = "https://nbctf.mod.gov.il/he/" +
		"MinisterSanctions/PropertyPerceptions/Pages/Blockchain.aspx"
	nbctfHomeURL = "https://nbctf.mod.gov.il/he/Pages/HomePage.aspx"
)

// FetchNBCTFCrypto fetches blockchain wallet data directly from
// Israel's NBCTF government site. No third-party mirrors — data
// sourced exclusively from the national authority.
// Strategy: SessionFetch → BrowserUA → Headless Chrome, with retries.
func FetchNBCTFCrypto() ([]domain.CryptoEntry, error) {
	// Strategy 1: session-based fetch (cookies + Referer)
	html, err := sessionFetchWithRetry()
	if err == nil && containsWalletData(html) {
		log.Printf("nbctf-crypto: session fetch succeeded (%d bytes)",
			len(html))
		return ParseNBCTFCrypto(html), nil
	}
	log.Printf("nbctf-crypto: session fetch failed: %v", err)

	// Strategy 2: direct browser UA with retries
	html, err = browserFetchWithRetry()
	if err == nil && containsWalletData(html) {
		log.Printf("nbctf-crypto: browser-UA succeeded (%d bytes)",
			len(html))
		return ParseNBCTFCrypto(html), nil
	}
	log.Printf("nbctf-crypto: browser-UA failed: %v", err)

	// Strategy 3: chromedp headless Chrome
	html, err = headlessFetchWithRetry()
	if err == nil && containsWalletData(html) {
		log.Printf("nbctf-crypto: chromedp succeeded")
		return ParseNBCTFCrypto(html), nil
	}
	log.Printf("nbctf-crypto: chromedp failed: %v", err)

	// Strategy 4: rod + stealth (anti-detection headless)
	html, err = rodFetchWithRetry()
	if err == nil && containsWalletData(html) {
		log.Printf("nbctf-crypto: rod-stealth succeeded")
		return ParseNBCTFCrypto(html), nil
	}
	log.Printf("nbctf-crypto: rod-stealth failed: %v", err)

	return nil, fmt.Errorf(
		"all NBCTF fetch strategies failed; site may be temporarily " +
			"unavailable — will retry on next scheduled sync")
}

func containsWalletData(html []byte) bool {
	s := string(html)
	return (strings.Contains(s, "0x") ||
		strings.Contains(s, "bc1") ||
		strings.Contains(s, "1A")) && len(s) > 1000
}
