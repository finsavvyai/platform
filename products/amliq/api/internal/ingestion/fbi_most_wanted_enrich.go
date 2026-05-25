package ingestion

import (
	"fmt"
	"strings"

	"github.com/aegis-aml/aegis/internal/domain"
)

func setFBIFields(ent *domain.Entity, item fbiItem) {
	// Dataset & schema
	setMeta(ent, "dataset", "fbi_wanted")
	setMeta(ent, "schemaType", "Person")

	// DOB
	if len(item.DatesOfBirth) > 0 {
		dob := item.DatesOfBirth[0]
		setMeta(ent, "dob", dob)
		parseDOB(ent, dob)
	}

	// Structured aliases land on Entity.Names as extra alias
	// entries, with parts blank since FBI provides only the full form.
	for _, a := range item.Aliases {
		normalized := NormalizeName(a)
		if normalized == "" {
			continue
		}
		if n, err := domain.NewName(normalized, "", "", ""); err == nil {
			ent.Names = append(ent.Names, n)
		}
	}

	// Physical description for disambiguation.
	setMeta(ent, "gender", item.Sex)
	setMeta(ent, "race", firstNonEmptyStr(item.Race, item.RaceRaw))
	setMeta(ent, "hair_color", item.Hair)
	setMeta(ent, "eye_color", item.Eyes)
	setMeta(ent, "build", item.Build)
	setMeta(ent, "complexion", item.Complexion)
	setMeta(ent, "scars_and_marks", item.ScarsAndMarks)
	setFBIRange(ent, "height", item.HeightMin, item.HeightMax, "in")
	setFBIRange(ent, "weight", item.WeightMin, item.WeightMax, "lb")
	setFBIRange(ent, "age", item.AgeMin, item.AgeMax, "")

	// Place of birth: prefer singular, fall back to first of plural.
	pob := firstNonEmptyStr(item.PlaceOfBirth)
	if pob == "" && len(item.PlacesOfBirth) > 0 {
		pob = item.PlacesOfBirth[0]
	}
	setMeta(ent, "birth_place", pob)

	// Occupation(s) and languages.
	if len(item.Occupations) > 0 {
		setMeta(ent, "occupations", strings.Join(item.Occupations, "; "))
	}
	if len(item.Languages) > 0 {
		setMeta(ent, "languages", strings.Join(item.Languages, "; "))
	}

	// Offenses & public-safety context.
	if len(item.Subjects) > 0 {
		setMeta(ent, "offenses", strings.Join(item.Subjects, "; "))
	}
	setMeta(ent, "caution", item.Caution)
	setMeta(ent, "warning_message", item.WarningMessage)
	setMeta(ent, "remarks", item.Remarks)
	setMeta(ent, "status", item.Status)
	setMeta(ent, "classification", item.PosterClassif)

	// Reward.
	setMeta(ent, "reward_text", item.RewardText)
	setFBIRange(ent, "reward", item.RewardMin, item.RewardMax, "USD")

	// First image — enough for alert-detail preview.
	if len(item.Images) > 0 {
		img := item.Images[0]
		setMeta(ent, "photo_url", firstNonEmptyStr(img.Original, img.Large, img.Thumb))
		setMeta(ent, "photo_caption", img.Caption)
	}

	// Source URL: prefer the item-specific permalink.
	src := firstNonEmptyStr(item.URL, "https://www.fbi.gov/wanted/")
	setMeta(ent, "source_url", src)
}

// setFBIRange writes "min-max unit" or "min unit" into metadata
// based on whether an inclusive range or single value is provided.
func setFBIRange(ent *domain.Entity, key string, min, max int, unit string) {
	if min == 0 && max == 0 {
		return
	}
	u := ""
	if unit != "" {
		u = " " + unit
	}
	if min == max || max == 0 {
		setMeta(ent, key, fmt.Sprintf("%d%s", min, u))
		return
	}
	setMeta(ent, key, fmt.Sprintf("%d-%d%s", min, max, u))
}
