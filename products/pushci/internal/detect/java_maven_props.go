package detect

import (
	"encoding/xml"
	"strings"
)

// MavenProps decodes the `<properties>` block. Go's xml package does
// not support maps directly — we walk tokens manually.
type MavenProps struct {
	Entries map[string]string `xml:"-"`
}

// UnmarshalXML collects arbitrary child element text pairs into the
// Entries map. Duplicates take the last occurrence, matching Maven's
// own behaviour.
func (m *MavenProps) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	if m.Entries == nil {
		m.Entries = map[string]string{}
	}
	for {
		tok, err := d.Token()
		if err != nil {
			return err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			var v string
			if err := d.DecodeElement(&v, &t); err != nil {
				return err
			}
			m.Entries[t.Name.Local] = strings.TrimSpace(v)
		case xml.EndElement:
			if t.Name == start.Name {
				return nil
			}
		}
	}
}
