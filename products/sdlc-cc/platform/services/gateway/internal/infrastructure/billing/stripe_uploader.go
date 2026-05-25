// Stripe metered-usage uploader — REAL HTTP implementation.
//
// Calls POST https://api.stripe.com/v1/subscription_items/{si}/usage_records
// with form-encoded body and Basic auth (api key + colon, no password).
//
// Idempotency-Key may be passed via context with WithIdempotencyKey so
// the caller's retry of the same logical operation does not double-bill.
package billing

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// StripeUploader is the concrete client. Use NewStripeUploader.
type StripeUploader struct {
	apiKey  string
	baseURL string
	hc      *http.Client
}

// NewStripeUploader constructs a real client. baseURL is overridable so
// httptest can stand in; pass "" for the live api.stripe.com endpoint.
func NewStripeUploader(apiKey, baseURL string) *StripeUploader {
	if baseURL == "" {
		baseURL = "https://api.stripe.com"
	}
	return &StripeUploader{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		hc:      &http.Client{Timeout: 30 * time.Second},
	}
}

// StripeError carries the parsed error body so callers can route on it.
type StripeError struct {
	StatusCode int
	Type       string
	Code       string
	Message    string
	RetryAfter time.Duration // populated for 429
}

// Error implements error.
func (e *StripeError) Error() string {
	return fmt.Sprintf("stripe %d %s/%s: %s", e.StatusCode, e.Type, e.Code, e.Message)
}

// IsAuth reports whether this is an auth failure (401).
func (e *StripeError) IsAuth() bool { return e.StatusCode == http.StatusUnauthorized }

// IsRateLimited reports whether this is a 429 (caller should respect RetryAfter).
func (e *StripeError) IsRateLimited() bool { return e.StatusCode == http.StatusTooManyRequests }

// idempotencyKeyCtxKey is the context-passing channel for Idempotency-Key.
type idempotencyKeyCtxKey struct{}

// WithIdempotencyKey returns a context carrying the supplied key. The key
// is forwarded to Stripe as Idempotency-Key on the next Upload call.
func WithIdempotencyKey(ctx context.Context, key string) context.Context {
	return context.WithValue(ctx, idempotencyKeyCtxKey{}, key)
}

// Upload posts one usage record to Stripe.
func (s *StripeUploader) Upload(
	ctx context.Context,
	subscriptionItemID string,
	quantity int,
	ts time.Time,
) error {
	if subscriptionItemID == "" {
		return fmt.Errorf("stripe: empty subscription_item_id")
	}
	form := url.Values{}
	form.Set("quantity", strconv.Itoa(quantity))
	form.Set("timestamp", strconv.FormatInt(ts.Unix(), 10))
	form.Set("action", "increment")
	body := form.Encode()

	endpoint := s.baseURL + "/v1/subscription_items/" + subscriptionItemID + "/usage_records"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", basicAuth(s.apiKey))
	if k, ok := ctx.Value(idempotencyKeyCtxKey{}).(string); ok && k != "" {
		req.Header.Set("Idempotency-Key", k)
	}

	resp, err := s.hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	return parseStripeError(resp.StatusCode, resp.Header, raw)
}

func basicAuth(apiKey string) string {
	enc := base64.StdEncoding.EncodeToString([]byte(apiKey + ":"))
	return "Basic " + enc
}

// parseStripeError pulls the JSON error envelope into StripeError.
// Malformed bodies still produce a useful error with the status code
// and a hint about the parse failure.
func parseStripeError(status int, hdr http.Header, raw []byte) error {
	out := &StripeError{StatusCode: status}
	var env struct {
		Error struct {
			Type    string `json:"type"`
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &env); err != nil || env.Error.Message == "" {
		out.Message = fmt.Sprintf("non-2xx response: %s", strings.TrimSpace(string(raw)))
	} else {
		out.Type = env.Error.Type
		out.Code = env.Error.Code
		out.Message = env.Error.Message
	}
	if status == http.StatusTooManyRequests {
		if v := hdr.Get("Retry-After"); v != "" {
			if secs, err := strconv.Atoi(v); err == nil && secs >= 0 {
				out.RetryAfter = time.Duration(secs) * time.Second
			}
		}
	}
	return out
}

// InvoiceUploader is the original invoice-level seam used by the cron;
// kept so the rest of the billing pipeline still composes. NoopUploader
// satisfies it for dev/CI when no Stripe key is configured.
type InvoiceUploader interface {
	Upload(ctx context.Context, inv *Invoice) error
}

// NoopLogger is the minimal interface NoopUploader needs; logrus.Logger
// satisfies it natively via its embedded std-lib Printf.
type NoopLogger interface {
	Printf(format string, v ...any)
}

// NoopUploader logs and returns nil. Useful for dev/CI without a key.
type NoopUploader struct {
	Logger NoopLogger
}

// Upload logs the would-be call and returns nil.
func (n *NoopUploader) Upload(_ context.Context, inv *Invoice) error {
	if n.Logger != nil {
		n.Logger.Printf("billing: NoopUploader pretend-uploaded invoice tenant=%s id=%s total=%d",
			inv.TenantID, inv.ID, inv.TotalUSDCents)
	}
	return nil
}
