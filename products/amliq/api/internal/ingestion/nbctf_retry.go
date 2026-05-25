package ingestion

import (
	"log"
	"time"
)

const maxRetries = 3

// sessionFetchWithRetry tries SessionFetch with exponential backoff.
func sessionFetchWithRetry() ([]byte, error) {
	var lastErr error
	for i := range maxRetries {
		html, err := SessionFetch(nbctfHomeURL, nbctfBlockchainURL)
		if err == nil {
			return html, nil
		}
		lastErr = err
		delay := time.Duration(1<<uint(i)) * 2 * time.Second
		log.Printf("nbctf session attempt %d/%d failed: %v, retry in %v",
			i+1, maxRetries, err, delay)
		time.Sleep(delay)
	}
	return nil, lastErr
}

// browserFetchWithRetry tries BrowserFetch with exponential backoff.
func browserFetchWithRetry() ([]byte, error) {
	var lastErr error
	for i := range maxRetries {
		html, err := BrowserFetch(nbctfBlockchainURL)
		if err == nil {
			return html, nil
		}
		lastErr = err
		delay := time.Duration(1<<uint(i)) * 2 * time.Second
		log.Printf("nbctf browser attempt %d/%d failed: %v, retry in %v",
			i+1, maxRetries, err, delay)
		time.Sleep(delay)
	}
	return nil, lastErr
}

// headlessFetchWithRetry tries chromedp with exponential backoff.
func headlessFetchWithRetry() ([]byte, error) {
	var lastErr error
	for i := range maxRetries {
		html, err := NBCTFHeadlessFetch(nbctfBlockchainURL)
		if err == nil {
			return html, nil
		}
		lastErr = err
		delay := time.Duration(1<<uint(i)) * 3 * time.Second
		log.Printf("nbctf chromedp attempt %d/%d failed: %v, retry in %v",
			i+1, maxRetries, err, delay)
		time.Sleep(delay)
	}
	return nil, lastErr
}

// rodFetchWithRetry tries rod+stealth with exponential backoff.
func rodFetchWithRetry() ([]byte, error) {
	var lastErr error
	for i := range maxRetries {
		html, err := RodHeadlessFetch(nbctfBlockchainURL)
		if err == nil {
			return html, nil
		}
		lastErr = err
		delay := time.Duration(1<<uint(i)) * 3 * time.Second
		log.Printf("nbctf rod attempt %d/%d failed: %v, retry in %v",
			i+1, maxRetries, err, delay)
		time.Sleep(delay)
	}
	return nil, lastErr
}
