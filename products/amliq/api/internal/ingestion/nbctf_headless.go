package ingestion

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/chromedp/chromedp"
)

// NBCTFHeadlessFetch uses headless Chrome via chromedp to render
// pages. Bypasses WAF/JS challenges that block plain HTTP.
// Configured to evade headless detection (webdriver flag, plugins).
func NBCTFHeadlessFetch(url string) ([]byte, error) {
	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features",
			"AutomationControlled"),
		chromedp.Flag("excludeSwitches", "enable-automation"),
		chromedp.Flag("disable-extensions", false),
		chromedp.UserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "+
				"AppleWebKit/537.36 (KHTML, like Gecko) "+
				"Chrome/131.0.0.0 Safari/537.36"),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(
		context.Background(), opts...)
	defer allocCancel()

	ctx, cancel := chromedp.NewContext(allocCtx)
	defer cancel()

	ctx, cancel = context.WithTimeout(ctx, 90*time.Second)
	defer cancel()

	var html string
	err := chromedp.Run(ctx,
		// Remove webdriver flag to avoid detection
		chromedp.ActionFunc(func(ctx context.Context) error {
			return chromedp.Evaluate(
				`Object.defineProperty(navigator, 'webdriver', {get: () => undefined})`,
				nil).Do(ctx)
		}),
		chromedp.Navigate(url),
		chromedp.WaitReady("body"),
		chromedp.Sleep(3*time.Second),
		chromedp.OuterHTML("html", &html),
	)
	if err != nil {
		return nil, fmt.Errorf("chromedp: %w", err)
	}

	log.Printf("headless: fetched %d bytes from %s",
		len(html), url)
	return []byte(html), nil
}
