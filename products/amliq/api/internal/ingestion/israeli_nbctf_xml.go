package ingestion

import (
	"encoding/xml"
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

// NBCTFXMLParser handles the SpreadsheetML (Excel 2003 XML) format
// published alongside the CSV feeds on nbctf.mod.gov.il.
// The XML encodes the same header layout as the CSV: Hebrew row 1,
// English row 2, data rows 3+.
type NBCTFXMLParser struct{ csv *NBCTFParser }

// NewNBCTFXMLParser returns a parser that decodes SpreadsheetML XML
// into [][]string records and delegates to the CSV header logic.
func NewNBCTFXMLParser() *NBCTFXMLParser {
	return &NBCTFXMLParser{csv: NewNBCTFParser()}
}

func (p *NBCTFXMLParser) Parse(
	data []byte,
) ([]domain.Entity, error) {
	records, err := spreadsheetMLToRecords(data)
	if err != nil {
		return nil, fmt.Errorf("xml decode: %w", err)
	}
	if len(records) < 3 {
		return nil, nil
	}
	hdr := buildHeaderIndex(records[1])
	return p.csv.parseWithHeaders(records[2:], hdr)
}

// SpreadsheetML 2003 namespace used in NBCTF XML exports is
// "urn:schemas-microsoft-com:office:spreadsheet". Struct tags below
// must use the fully-qualified form or encoding/xml silently skips
// every element.
//
// spreadsheetMLToRecords extracts all Row/Cell/Data text from
// SpreadsheetML into a flat [][]string (like csv.ReadAll output).
func spreadsheetMLToRecords(data []byte) ([][]string, error) {
	type dataEl struct {
		Text string `xml:",chardata"`
	}
	type cell struct {
		Index int    `xml:"urn:schemas-microsoft-com:office:spreadsheet Index,attr"`
		Data  dataEl `xml:"urn:schemas-microsoft-com:office:spreadsheet Data"`
	}
	type row struct {
		Cells []cell `xml:"urn:schemas-microsoft-com:office:spreadsheet Cell"`
	}
	type table struct {
		Rows []row `xml:"urn:schemas-microsoft-com:office:spreadsheet Row"`
	}
	type worksheet struct {
		Table table `xml:"urn:schemas-microsoft-com:office:spreadsheet Table"`
	}
	type workbook struct {
		Sheets []worksheet `xml:"urn:schemas-microsoft-com:office:spreadsheet Worksheet"`
	}

	var wb workbook
	if err := xml.Unmarshal(data, &wb); err != nil {
		return nil, err
	}
	if len(wb.Sheets) == 0 {
		return nil, nil
	}

	var records [][]string
	for _, r := range wb.Sheets[0].Table.Rows {
		var rec []string
		col := 0
		for _, c := range r.Cells {
			if c.Index > 0 {
				for col < c.Index-1 {
					rec = append(rec, "")
					col++
				}
			}
			rec = append(rec, unescapeXML(c.Data.Text))
			col++
		}
		records = append(records, rec)
	}
	return records, nil
}

func unescapeXML(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	s = strings.ReplaceAll(s, "&#45;", "-")
	return strings.TrimSpace(s)
}
