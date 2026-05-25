package main

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strings"
	"unicode/utf8"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/screening"
)

func processEntities(in io.Reader, out io.Writer) (int, error) {
	r := csv.NewReader(in)
	r.LazyQuotes = true
	r.FieldsPerRecord = -1

	w := csv.NewWriter(out)
	defer w.Flush()

	total, entities := 0, 0
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil || len(rec) < 3 {
			continue
		}
		id := sanitize(rec[0], 250)
		name := sanitize(rec[1], 500)
		listID := rec[2]
		if id == "" || name == "" {
			continue
		}
		fps := genFPs(id, name, listID)
		for _, fp := range fps {
			w.Write([]string{fp.EntityID, fmt.Sprintf("%d", fp.Type), fp.Value})
			total++
		}
		entities++
		if entities%100000 == 0 {
			log.Printf("  → %d entities, %d fingerprints...", entities, total)
		}
	}
	log.Printf("Done: %d entities → %d fingerprints", entities, total)
	return total, nil
}

func genFPs(id, name, listID string) []screening.Fingerprint {
	eid, _ := domain.NewEntityID(id)
	n, _ := domain.NewName(name, "", "", "")
	e := domain.Entity{ID: eid, Names: []domain.Name{n}, ListID: listID}
	fps := screening.GenerateFingerprints(e)
	clean := make([]screening.Fingerprint, 0, len(fps))
	for _, fp := range fps {
		v := sanitize(fp.Value, 255)
		if v != "" {
			clean = append(clean, screening.Fingerprint{
				EntityID: fp.EntityID, Type: fp.Type, Value: v,
			})
		}
	}
	return clean
}

func sanitize(s string, max int) string {
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "")
	}
	if len(s) > max {
		for max > 0 && !utf8.RuneStart(s[max]) {
			max--
		}
		s = s[:max]
	}
	return s
}
