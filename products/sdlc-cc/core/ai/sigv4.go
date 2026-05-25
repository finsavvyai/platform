package ai

// AWS SigV4 request signer (hand-rolled, no aws-sdk-go dep).
// Reference: https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
//
// Scope: signs POST/GET requests with a JSON body for Bedrock. Session
// tokens (X-Amz-Security-Token) supported. Time and payload-hash
// injection supported for golden-vector testing.

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"
)

const sigv4Algorithm = "AWS4-HMAC-SHA256"

// sigV4Signer holds the credential set for one AWS account/role.
type sigV4Signer struct {
	accessKey    string
	secretKey    string
	sessionToken string
	region       string
	service      string
}

// sign mutates req.Header to include the SigV4 authorization headers.
// payload is the raw request body; now is the signing timestamp
// (injected so tests can compare against the AWS reference vectors).
func (s *sigV4Signer) sign(req *http.Request, payload []byte, now time.Time) {
	t := now.UTC()
	amzDate := t.Format("20060102T150405Z")
	dateStamp := t.Format("20060102")

	req.Header.Set("host", req.Host)
	req.Header.Set("x-amz-date", amzDate)
	if s.sessionToken != "" {
		req.Header.Set("x-amz-security-token", s.sessionToken)
	}
	hashedPayload := sha256Hex(payload)

	canonicalHeaders, signedHeaders := canonicalizeHeaders(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		canonicalURI(req),
		canonicalQuery(req),
		canonicalHeaders,
		signedHeaders,
		hashedPayload,
	}, "\n")

	credScope := strings.Join(
		[]string{dateStamp, s.region, s.service, "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		sigv4Algorithm,
		amzDate,
		credScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	signingKey := deriveSigningKey(s.secretKey, dateStamp, s.region, s.service)
	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))

	auth := sigv4Algorithm +
		" Credential=" + s.accessKey + "/" + credScope +
		", SignedHeaders=" + signedHeaders +
		", Signature=" + signature
	req.Header.Set("Authorization", auth)
}

func deriveSigningKey(secret, date, region, service string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(date))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}

func sha256Hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}
