package ingestion

import (
	"fmt"
	"log"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/stealth"
)

// RodHeadlessFetch uses go-rod with stealth plugin to render pages.
// Rod has better anti-detection than raw chromedp — patches
// navigator.webdriver, chrome.runtime, plugins array, and more.
// Used as fallback when chromedp fails against aggressive WAFs.
func RodHeadlessFetch(url string) ([]byte, error) {
	path, found := launcher.LookPath()
	if !found {
		return nil, fmt.Errorf("rod: chrome/chromium not found")
	}

	u := launcher.New().
		Bin(path).
		Headless(true).
		Set("disable-gpu").
		Set("no-sandbox").
		Set("disable-dev-shm-usage").
		Set("disable-blink-features", "AutomationControlled").
		MustLaunch()

	browser := rod.New().ControlURL(u)
	if err := browser.Connect(); err != nil {
		return nil, fmt.Errorf("rod connect: %w", err)
	}
	defer browser.MustClose()

	// Stealth plugin patches all headless detection vectors
	page, err := stealth.Page(browser)
	if err != nil {
		return nil, fmt.Errorf("rod stealth page: %w", err)
	}

	page = page.Timeout(90 * time.Second)

	if err := page.Navigate(url); err != nil {
		return nil, fmt.Errorf("rod navigate: %w", err)
	}
	if err := page.WaitStable(2 * time.Second); err != nil {
		return nil, fmt.Errorf("rod wait: %w", err)
	}

	html, err := page.HTML()
	if err != nil {
		return nil, fmt.Errorf("rod html: %w", err)
	}

	log.Printf("rod-stealth: fetched %d bytes from %s",
		len(html), shortURL(url))
	return []byte(html), nil
}
