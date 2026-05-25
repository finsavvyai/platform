// Package notification — Twilio Verify API for WhatsApp/SMS OTP.
package notification

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
)

// VerifyChannel is the delivery channel for OTP codes.
type VerifyChannel string

const (
	ChannelSMS      VerifyChannel = "sms"
	ChannelWhatsApp VerifyChannel = "whatsapp"
	ChannelEmail    VerifyChannel = "email"
	ChannelCall     VerifyChannel = "call"
)

// TwilioVerifier sends and checks OTP codes via Twilio Verify API.
type TwilioVerifier struct {
	accountSID string
	authToken  string
	serviceSID string
}

func NewTwilioVerifier() *TwilioVerifier {
	return &TwilioVerifier{
		accountSID: os.Getenv("TWILIO_ACCOUNT_SID"),
		authToken:  os.Getenv("TWILIO_AUTH_TOKEN"),
		serviceSID: os.Getenv("TWILIO_VERIFICATION_SID"),
	}
}

// IsConfigured returns true if Verify API is usable.
func (v *TwilioVerifier) IsConfigured() bool {
	return v.accountSID != "" && v.authToken != "" && v.serviceSID != ""
}

type verifyResponse struct {
	SID    string `json:"sid"`
	Status string `json:"status"`
	To     string `json:"to"`
	Valid  bool   `json:"valid,omitempty"`
}

// Send initiates an OTP via the given channel.
// to: E.164 phone (+15551234567) or email.
func (v *TwilioVerifier) Send(
	to string, channel VerifyChannel,
) (*verifyResponse, error) {
	if !v.IsConfigured() {
		return nil, fmt.Errorf("twilio verify not configured")
	}
	endpoint := fmt.Sprintf(
		"https://verify.twilio.com/v2/Services/%s/Verifications",
		v.serviceSID)

	form := url.Values{}
	form.Set("To", to)
	form.Set("Channel", string(channel))

	return v.post(endpoint, form)
}

// Check validates an OTP code the user submitted.
func (v *TwilioVerifier) Check(
	to, code string,
) (*verifyResponse, error) {
	if !v.IsConfigured() {
		return nil, fmt.Errorf("twilio verify not configured")
	}
	endpoint := fmt.Sprintf(
		"https://verify.twilio.com/v2/Services/%s/VerificationCheck",
		v.serviceSID)

	form := url.Values{}
	form.Set("To", to)
	form.Set("Code", code)

	return v.post(endpoint, form)
}

func (v *TwilioVerifier) post(
	endpoint string, form url.Values,
) (*verifyResponse, error) {
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(v.accountSID, v.authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("twilio verify: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("twilio verify HTTP %d: %s",
			resp.StatusCode, string(body))
	}

	var out verifyResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &out, nil
}
