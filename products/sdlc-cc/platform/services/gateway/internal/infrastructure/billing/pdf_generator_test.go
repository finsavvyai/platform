package billing

import (
	"bytes"
	"testing"
	"time"

	"github.com/google/uuid"
)

func makeInvoice(t *testing.T, items []LineItem, withTier bool) *Invoice {
	t.Helper()
	var subtotal int64
	for _, li := range items {
		subtotal += li.USDCents
	}
	inv := &Invoice{
		ID:               uuid.New(),
		TenantID:         uuid.New(),
		Year:             2026,
		Month:            time.April,
		SubtotalUSDCents: subtotal,
		TotalUSDCents:    subtotal,
		Status:           "draft",
		GeneratedAt:      time.Date(2026, 4, 1, 12, 0, 0, 0, time.UTC),
		LineItems:        items,
	}
	if withTier {
		tier := &Tier{
			ID:                uuid.New(),
			ContractID:        uuid.New(),
			ThresholdUSDCents: 10000,
			DiscountPct:       15,
		}
		inv.AppliedTier = tier
		inv.DiscountUSDCents = (subtotal * 15) / 100
		inv.TotalUSDCents = subtotal - inv.DiscountUSDCents
	}
	return inv
}

func TestGoFPDFGenerator_StartsWithPDFMagic(t *testing.T) {
	gen := GoFPDFGenerator{}
	inv := makeInvoice(t, []LineItem{
		{Provider: "openai", Model: "gpt-4", PromptTokens: 100, CompletionTokens: 200, USDCents: 500},
	}, false)
	out, err := gen.Generate(inv)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if len(out) == 0 {
		t.Fatal("Generate returned empty bytes")
	}
	if !bytes.HasPrefix(out, []byte("%PDF-")) {
		t.Fatalf("expected %%PDF- prefix, got %q", out[:min(len(out), 16)])
	}
}

func TestGoFPDFGenerator_LengthGrowsWithItems(t *testing.T) {
	gen := GoFPDFGenerator{}
	one := makeInvoice(t, []LineItem{
		{Provider: "openai", Model: "gpt-4", PromptTokens: 1, CompletionTokens: 1, USDCents: 100},
	}, false)
	many := makeInvoice(t, []LineItem{
		{Provider: "openai", Model: "gpt-4", PromptTokens: 1, CompletionTokens: 1, USDCents: 100},
		{Provider: "anthropic", Model: "claude-3-opus", PromptTokens: 2, CompletionTokens: 2, USDCents: 200},
		{Provider: "anthropic", Model: "claude-3-sonnet", PromptTokens: 3, CompletionTokens: 3, USDCents: 300},
		{Provider: "openai", Model: "gpt-3.5", PromptTokens: 4, CompletionTokens: 4, USDCents: 400},
	}, false)
	a, err := gen.Generate(one)
	if err != nil {
		t.Fatalf("one: %v", err)
	}
	b, err := gen.Generate(many)
	if err != nil {
		t.Fatalf("many: %v", err)
	}
	if len(b) <= len(a) {
		t.Fatalf("expected larger PDF for more items: %d vs %d", len(b), len(a))
	}
}

func TestGoFPDFGenerator_DiscountRendered(t *testing.T) {
	gen := GoFPDFGenerator{}
	inv := makeInvoice(t, []LineItem{
		{Provider: "openai", Model: "gpt-4", PromptTokens: 1000, CompletionTokens: 500, USDCents: 20000},
	}, true)
	out, err := gen.Generate(inv)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	// gofpdf renders text content into the PDF stream as plain ASCII
	// for the Helvetica core font, so we can search the raw bytes.
	if !bytes.Contains(out, []byte("Discount")) {
		t.Fatal("expected 'Discount' text in PDF output")
	}
	if !bytes.Contains(out, []byte("15%")) {
		t.Fatal("expected discount percentage '15%' in PDF output")
	}
	if !bytes.Contains(out, []byte("Total:")) {
		t.Fatal("expected 'Total:' label in PDF output")
	}
}

func TestGoFPDFGenerator_EOFSanity(t *testing.T) {
	gen := GoFPDFGenerator{CompanyName: "Acme Co.", FooterTerms: "Net 15."}
	inv := makeInvoice(t, []LineItem{
		{Provider: "openai", Model: "gpt-4", PromptTokens: 10, CompletionTokens: 20, USDCents: 1234},
	}, false)
	out, err := gen.Generate(inv)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if !bytes.HasPrefix(out, []byte("%PDF-")) {
		t.Fatal("missing %PDF- header")
	}
	// Trailing %%EOF marker (may be followed by whitespace).
	trimmed := bytes.TrimRight(out, "\r\n\t ")
	if !bytes.HasSuffix(trimmed, []byte("%%EOF")) {
		tail := trimmed
		if len(tail) > 32 {
			tail = tail[len(tail)-32:]
		}
		t.Fatalf("missing %%%%EOF trailer; tail=%q", tail)
	}
	if !bytes.Contains(out, []byte("Acme Co.")) {
		t.Fatal("expected custom company name in PDF")
	}
	if !bytes.Contains(out, []byte("Net 15.")) {
		t.Fatal("expected custom footer terms in PDF")
	}
}

func TestGoFPDFGenerator_NilInvoice(t *testing.T) {
	gen := GoFPDFGenerator{}
	if _, err := gen.Generate(nil); err == nil {
		t.Fatal("expected error for nil invoice")
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func TestCentsAsDollarString_Negative(t *testing.T) {
	cases := []struct {
		cents int64
		want  string
	}{
		{12345, "123.45"},
		{0, "0.00"},
		{-12345, "-123.45"},
		{100, "1.00"},
		{1, "0.01"},
	}
	for _, tc := range cases {
		if got := centsAsDollarString(tc.cents); got != tc.want {
			t.Errorf("centsAsDollarString(%d) = %q, want %q", tc.cents, got, tc.want)
		}
	}
}
