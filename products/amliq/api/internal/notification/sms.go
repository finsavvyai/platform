// Package notification SMS via Twilio.
package notification

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// SMSSender sends SMS messages.
type SMSSender interface {
	Send(to, body string) error
}

// TwilioSender uses Twilio Messages API.
type TwilioSender struct {
	accountSID string
	authToken  string
	fromNum    string
}

func NewTwilioSender() *TwilioSender {
	// Accept either TWILIO_FROM_NUMBER or TWILIO_PHONE_NUMBER
	from := os.Getenv("TWILIO_FROM_NUMBER")
	if from == "" {
		from = os.Getenv("TWILIO_PHONE_NUMBER")
	}
	return &TwilioSender{
		accountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		authToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		fromNum:    from,
	}
}

func (t *TwilioSender) Send(to, body string) error {
	if t.accountSID == "" || t.authToken == "" || t.fromNum == "" {
		return fmt.Errorf("twilio credentials not configured")
	}
	endpoint := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		t.accountSID)
	form := url.Values{}
	form.Set("To", to)
	form.Set("From", t.fromNum)
	form.Set("Body", body)

	req, err := http.NewRequest("POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(t.accountSID, t.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("twilio: HTTP %d", resp.StatusCode)
	}
	return nil
}

// NoopSMSSender logs SMS instead of sending.
type NoopSMSSender struct{}

func (n *NoopSMSSender) Send(to, body string) error {
	fmt.Printf("SMS [noop] to=%s body=%q\n", to, body)
	return nil
}

// NewSMSSender returns Twilio if configured, noop otherwise.
func NewSMSSender() SMSSender {
	if os.Getenv("TWILIO_ACCOUNT_SID") != "" {
		return NewTwilioSender()
	}
	return &NoopSMSSender{}
}
