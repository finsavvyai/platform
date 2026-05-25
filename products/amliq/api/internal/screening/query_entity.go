package screening

import "github.com/aegis-aml/aegis/internal/domain"

// BuildQueryEntity creates a temporary entity for screening a name.
func BuildQueryEntity(name string) domain.Entity {
	id, _ := domain.NewEntityID("ent_query000000")
	n, err := domain.NewName(name, "", "", "")
	if err != nil {
		// Fallback: create entity with raw name
		return domain.Entity{
			Names: []domain.Name{{Full: name}},
		}
	}
	e, err := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{n})
	if err != nil {
		return domain.Entity{
			Names: []domain.Name{n},
		}
	}
	return e
}
