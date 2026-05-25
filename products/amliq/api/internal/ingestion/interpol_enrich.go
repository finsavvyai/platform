package ingestion

import (
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setInterpolFields(ent *domain.Entity, notice interpolNotice) {
	setMeta(ent, "dataset", "interpol_red")
	setMeta(ent, "schemaType", "Person")

	// DOB
	if notice.DateOfBirth != "" {
		setMeta(ent, "dob", notice.DateOfBirth)
		parseDOB(ent, notice.DateOfBirth)
	}

	// Place of birth (city + country).
	pob := strings.TrimSpace(notice.PlaceOfBirth)
	if pob != "" && notice.CountryOfBirth != "" {
		pob = pob + ", " + strings.TrimSpace(notice.CountryOfBirth)
	} else if pob == "" {
		pob = strings.TrimSpace(notice.CountryOfBirth)
	}
	setMeta(ent, "birth_place", pob)

	// Physical description.
	setMeta(ent, "gender", notice.Sex)
	setMeta(ent, "height", notice.Height)
	setMeta(ent, "weight", notice.Weight)
	setMeta(ent, "hair_color", notice.HairColor)
	setMeta(ent, "eye_color", notice.EyeColor)
	setMeta(ent, "scars_and_marks", notice.Distinguishing)

	// Languages.
	if len(notice.Languages) > 0 {
		setMeta(ent, "languages", strings.Join(notice.Languages, "; "))
	}

	// Arrest warrants / charges.
	if len(notice.Arrest) > 0 {
		var charges []string
		var countries []string
		for _, w := range notice.Arrest {
			if c := strings.TrimSpace(w.Charge); c != "" {
				charges = append(charges, c)
			}
			if c := strings.TrimSpace(w.IssuingCountry); c != "" {
				countries = append(countries, c)
			}
		}
		if len(charges) > 0 {
			setMeta(ent, "offenses", strings.Join(charges, "; "))
		}
		if len(countries) > 0 {
			setMeta(ent, "issuing_countries", strings.Join(countries, "; "))
		}
	}

	// Thumbnail photo for alert UI.
	if notice.Links.Thumbnail.Href != "" {
		setMeta(ent, "photo_url", notice.Links.Thumbnail.Href)
	}

	setMeta(ent, "source_url",
		"https://www.interpol.int/en/How-we-work/Notices/Red-Notices")
}
