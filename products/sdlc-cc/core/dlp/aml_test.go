package dlp

import (
	"strings"
	"testing"
)

// TestMaskAML_Composite asserts the canonical pre-LLM pipeline.
// Anything in `forbidden` appearing in the output means the redactor
// would leak PII to the model — a P0 compliance bug.
func TestMaskAML_Composite(t *testing.T) {
	in := "Customer 4111-1111-1111-1111 " +
		"IBAN DE89370400440532013000 " +
		"BIC DEUTDEFF email a@b.co ID 123456782"
	got := MaskAML(in)
	forbidden := []string{
		"4111-1111-1111-1111",
		"DE89370400440532013000",
		"DEUTDEFF",
		"a@b.co",
		"123456782",
	}
	for _, sub := range forbidden {
		if strings.Contains(got, sub) {
			t.Errorf("MaskAML output still contains %q: %q", sub, got)
		}
	}
}
