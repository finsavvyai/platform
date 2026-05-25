package handlers

import (
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// SSOTestRequest represents a SAML metadata validation request.
type SSOTestRequest struct {
	Metadata    string `json:"metadata"`
	MetadataURL string `json:"metadata_url,omitempty"`
	EntityID    string `json:"entity_id,omitempty"`
}

// SSOTestResponse reports the outcome of a metadata pre-flight check.
type SSOTestResponse struct {
	OK          bool     `json:"ok"`
	EntityID    string   `json:"entity_id,omitempty"`
	SSOURL      string   `json:"sso_url,omitempty"`
	CertCount   int      `json:"cert_count"`
	NameIDForm  string   `json:"nameid_format,omitempty"`
	Bindings    []string `json:"bindings,omitempty"`
	Warnings    []string `json:"warnings,omitempty"`
	Error       string   `json:"error,omitempty"`
	ValidatedAt string   `json:"validated_at"`
}

type samlMetadata struct {
	XMLName      xml.Name `xml:"EntityDescriptor"`
	EntityID     string   `xml:"entityID,attr"`
	IDPSSOConfig *struct {
		NameIDFormats []string `xml:"NameIDFormat"`
		SSOServices   []struct {
			Binding  string `xml:"Binding,attr"`
			Location string `xml:"Location,attr"`
		} `xml:"SingleSignOnService"`
		KeyDescriptors []struct {
			Use     string `xml:"use,attr"`
			KeyInfo struct {
				X509Data struct {
					X509Certificate string `xml:"X509Certificate"`
				} `xml:"X509Data"`
			} `xml:"KeyInfo"`
		} `xml:"KeyDescriptor"`
	} `xml:"IDPSSODescriptor"`
}

// TestSSOMetadata handles POST /api/v1/admin/sso/test.
// Validates SAML IdP metadata before an admin saves it. Read-only, no persistence.
func (h *Handlers) TestSSOMetadata(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SSOTestRequest
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		jsonError(w, "failed to read body", http.StatusBadRequest)
		return
	}

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/xml") || strings.Contains(contentType, "text/xml") {
		req.Metadata = string(body)
	} else if err := json.Unmarshal(body, &req); err != nil {
		jsonError(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	xmlBlob := strings.TrimSpace(req.Metadata)
	if xmlBlob == "" && req.MetadataURL != "" {
		xmlBlob, err = fetchMetadata(req.MetadataURL)
		if err != nil {
			writeSSOTest(w, SSOTestResponse{Error: "fetch failed: " + err.Error()})
			return
		}
	}

	if xmlBlob == "" {
		jsonError(w, "metadata or metadata_url required", http.StatusBadRequest)
		return
	}

	resp := validateSAMLMetadata(xmlBlob, req.EntityID)
	writeSSOTest(w, resp)
}

func fetchMetadata(url string) (string, error) {
	if !strings.HasPrefix(url, "https://") {
		return "", fmt.Errorf("metadata_url must use https")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func validateSAMLMetadata(xmlBlob, expectedEntityID string) SSOTestResponse {
	resp := SSOTestResponse{ValidatedAt: time.Now().UTC().Format(time.RFC3339)}

	var md samlMetadata
	if err := xml.Unmarshal([]byte(xmlBlob), &md); err != nil {
		resp.Error = "invalid XML: " + err.Error()
		return resp
	}

	if md.EntityID == "" {
		resp.Error = "entityID missing"
		return resp
	}
	resp.EntityID = md.EntityID

	if expectedEntityID != "" && md.EntityID != expectedEntityID {
		resp.Warnings = append(resp.Warnings, fmt.Sprintf("entityID mismatch: got %q, expected %q", md.EntityID, expectedEntityID))
	}

	if md.IDPSSOConfig == nil {
		resp.Error = "IDPSSODescriptor missing"
		return resp
	}

	for _, svc := range md.IDPSSOConfig.SSOServices {
		if resp.SSOURL == "" && strings.Contains(svc.Binding, "HTTP-Redirect") {
			resp.SSOURL = svc.Location
		}
		resp.Bindings = append(resp.Bindings, svc.Binding)
	}
	if resp.SSOURL == "" && len(md.IDPSSOConfig.SSOServices) > 0 {
		resp.SSOURL = md.IDPSSOConfig.SSOServices[0].Location
	}
	if resp.SSOURL == "" {
		resp.Error = "no SingleSignOnService endpoints declared"
		return resp
	}

	if len(md.IDPSSOConfig.NameIDFormats) > 0 {
		resp.NameIDForm = md.IDPSSOConfig.NameIDFormats[0]
	}

	for _, kd := range md.IDPSSOConfig.KeyDescriptors {
		if strings.TrimSpace(kd.KeyInfo.X509Data.X509Certificate) == "" {
			continue
		}
		if _, err := base64.StdEncoding.DecodeString(stripWhitespace(kd.KeyInfo.X509Data.X509Certificate)); err != nil {
			resp.Warnings = append(resp.Warnings, "signing cert is not valid base64")
			continue
		}
		resp.CertCount++
	}
	if resp.CertCount == 0 {
		resp.Warnings = append(resp.Warnings, "no signing certificates declared — signature verification will be disabled")
	}

	resp.OK = resp.Error == ""
	return resp
}

func stripWhitespace(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r == ' ' || r == '\n' || r == '\r' || r == '\t' {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func writeSSOTest(w http.ResponseWriter, resp SSOTestResponse) {
	if resp.Error != "" {
		jsonOK(w, resp)
		return
	}
	jsonOK(w, resp)
}
