// REAL — uses github.com/jung-kurt/gofpdf.
// Add to go.mod via:
//   cd services/gateway && go get github.com/jung-kurt/gofpdf@latest && go mod tidy
//
// Renders an Invoice into a real PDF byte buffer suitable for email
// attachment, S3 upload, or Stripe `invoice.upload`. The MarkdownInvoiceRenderer
// remains for human-diffable plain text output and is unchanged.
package billing

import (
	"bytes"
	"fmt"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// PDFGenerator is the public seam used by the monthly cron + Stripe upload.
type PDFGenerator interface {
	Generate(invoice *Invoice) ([]byte, error)
}

// GoFPDFGenerator is the real implementation backed by gofpdf.
// Zero-value usable; CompanyName / FooterTerms can be overridden.
type GoFPDFGenerator struct {
	CompanyName string
	FooterTerms string
}

// Generate builds the invoice PDF and returns the raw bytes.
func (g GoFPDFGenerator) Generate(inv *Invoice) ([]byte, error) {
	if inv == nil {
		return nil, fmt.Errorf("billing: nil invoice")
	}
	companyName := g.CompanyName
	if companyName == "" {
		companyName = "SDLC Platform, Inc."
	}
	footerTerms := g.FooterTerms
	if footerTerms == "" {
		footerTerms = "Net 30. Questions: billing@sdlc.cc."
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	// Plaintext content stream: keeps Helvetica text as `(...) Tj`
	// ops in the bytes so the output is grep-able for ops debugging
	// + makes deterministic content-search tests possible. Tradeoff
	// is ~30% larger files, which is negligible for invoices.
	pdf.SetCompression(false)
	pdf.AddPage()

	// Header — company + invoice meta.
	pdf.SetFont("Helvetica", "B", 18)
	pdf.CellFormat(0, 10, companyName, "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, "[LOGO]", "", 1, "L", false, 0, "")
	pdf.Ln(4)

	pdf.SetFont("Helvetica", "B", 14)
	pdf.CellFormat(0, 8, fmt.Sprintf("Invoice %s", inv.ID.String()), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("Period: %s %d", inv.Month.String(), inv.Year), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 6, fmt.Sprintf("Generated: %s", inv.GeneratedAt.Format(time.RFC3339)), "", 1, "L", false, 0, "")
	pdf.CellFormat(0, 6, fmt.Sprintf("Status: %s", inv.Status), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Bill-to.
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 6, "Bill To", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 5, fmt.Sprintf("Tenant ID: %s", inv.TenantID.String()), "", 1, "L", false, 0, "")
	pdf.Ln(4)

	// Line items table.
	pdf.SetFont("Helvetica", "B", 10)
	headers := []string{"Provider", "Model", "Prompt tok", "Compl tok", "USD"}
	widths := []float64{30, 60, 30, 30, 30}
	for i, h := range headers {
		pdf.CellFormat(widths[i], 7, h, "1", 0, "C", false, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Helvetica", "", 9)
	for _, li := range inv.LineItems {
		pdf.CellFormat(widths[0], 6, li.Provider, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[1], 6, li.Model, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 6, fmt.Sprintf("%d", li.PromptTokens), "1", 0, "R", false, 0, "")
		pdf.CellFormat(widths[3], 6, fmt.Sprintf("%d", li.CompletionTokens), "1", 0, "R", false, 0, "")
		pdf.CellFormat(widths[4], 6, "$"+centsAsDollarString(li.USDCents), "1", 0, "R", false, 0, "")
		pdf.Ln(-1)
	}
	pdf.Ln(4)

	// Totals.
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("Subtotal: $%s", centsAsDollarString(inv.SubtotalUSDCents)), "", 1, "R", false, 0, "")
	if inv.AppliedTier != nil {
		line := fmt.Sprintf("Discount (%d%% — tier $%s): -$%s",
			inv.AppliedTier.DiscountPct,
			centsAsDollarString(inv.AppliedTier.ThresholdUSDCents),
			centsAsDollarString(inv.DiscountUSDCents))
		pdf.CellFormat(0, 6, line, "", 1, "R", false, 0, "")
	}
	pdf.SetFont("Helvetica", "B", 11)
	pdf.CellFormat(0, 7, fmt.Sprintf("Total: $%s", centsAsDollarString(inv.TotalUSDCents)), "", 1, "R", false, 0, "")

	// Footer.
	pdf.Ln(8)
	pdf.SetFont("Helvetica", "I", 8)
	pdf.MultiCell(0, 4, footerTerms, "", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("billing: pdf output: %w", err)
	}
	return buf.Bytes(), nil
}

// centsAsDollarString formats integer cents as a dollar string (e.g.
// 12345 -> "123.45"). Negative cents are prefixed with a single minus.
func centsAsDollarString(cents int64) string {
	neg := ""
	if cents < 0 {
		neg = "-"
		cents = -cents
	}
	dollars := cents / 100
	rem := cents % 100
	return fmt.Sprintf("%s%d.%02d", neg, dollars, rem)
}
