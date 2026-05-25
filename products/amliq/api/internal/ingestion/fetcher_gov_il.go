package ingestion

import (
	"fmt"
	"log"
	"strings"
	"time"
)

// isIsraeliGovDomain returns true for Israeli government URLs
// that require browser-like headers to avoid 403 blocks.
// Israeli gov sites (mod.gov.il, gov.il) have WAF/bot detection
// that blocks Go's default HTTP client even in production.
func isIsraeliGovDomain(url string) bool {
	return strings.Contains(url, ".gov.il")
}

// FetchIsraeliGov fetches Israeli government URLs with full browser
// fingerprinting and session cookie support. 4 strategies:
// session → browser UA → chromedp headless → rod stealth.
// Used for NBCTF sanctions CSVs, Treasury XLSX, blockchain page, etc.
func FetchIsraeliGov(url string) ([]byte, error) {
	// Strategy 1: session-based (homepage cookies → target)
	baseURL := extractGovBaseURL(url)
	data, err := SessionFetch(baseURL, url)
	if err == nil && len(data) > 100 {
		log.Printf("il-gov %s: session fetch ok (%d bytes)",
			shortURL(url), len(data))
		return data, nil
	}
	log.Printf("il-gov: session failed: %v", err)

	// Strategy 2: direct browser UA with retries
	for i := range 3 {
		data, err = BrowserFetch(url)
		if err == nil && len(data) > 100 {
			log.Printf("il-gov %s: browser-UA ok", shortURL(url))
			return data, nil
		}
		time.Sleep(time.Duration(1<<uint(i)) * 2 * time.Second)
	}
	log.Printf("il-gov: browser-UA failed: %v", err)

	// Strategy 3: chromedp headless Chrome
	data, err = NBCTFHeadlessFetch(url)
	if err == nil && len(data) > 100 {
		log.Printf("il-gov %s: chromedp ok", shortURL(url))
		return data, nil
	}
	log.Printf("il-gov: chromedp failed: %v", err)

	// Strategy 4: rod + stealth (anti-detection headless)
	data, err = RodHeadlessFetch(url)
	if err == nil && len(data) > 100 {
		log.Printf("il-gov %s: rod-stealth ok", shortURL(url))
		return data, nil
	}
	log.Printf("il-gov: rod-stealth failed: %v", err)

	return nil, fmt.Errorf(
		"all 4 strategies failed for %s: %w", shortURL(url), err)
}

func extractGovBaseURL(url string) string {
	if strings.Contains(url, "nbctf.mod.gov.il") {
		return "https://nbctf.mod.gov.il/he/Pages/HomePage.aspx"
	}
	return "https://www.gov.il"
}

func shortURL(url string) string {
	if len(url) > 60 {
		return url[:57] + "..."
	}
	return url
}
