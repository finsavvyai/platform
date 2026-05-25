package api

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
	"github.com/aegis-aml/aegis/internal/storage"
)

func TestHydrateMatchEntities(t *testing.T) {
	mk := func(id string) domain.MatchResult {
		eid, _ := domain.NewEntityID(id)
		conf, _ := domain.NewConfidence(0.9)
		return domain.NewMatchResult(eid, conf, domain.DispositionReview,
			nil, "e", "list_a")
	}
	seed := func(repo storage.EntityRepository, ids ...string) {
		for _, id := range ids {
			eid, _ := domain.NewEntityID(id)
			n, _ := domain.NewName("Jane Doe", "", "", "")
			e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual,
				[]domain.Name{n})
			e.Metadata["dataset"] = "us_ofac_sdn"
			_ = repo.Create(e)
		}
	}

	tests := []struct {
		name    string
		matches []domain.MatchResult
		seedIDs []string
		nilRepo bool
		want    int
	}{
		{name: "empty_matches", want: 0},
		{name: "nil_repo", matches: []domain.MatchResult{mk("ent_aaaaaaaaaaaaa")}, nilRepo: true, want: 0},
		{name: "hit", matches: []domain.MatchResult{mk("ent_aaaaaaaaaaaaa")}, seedIDs: []string{"ent_aaaaaaaaaaaaa"}, want: 1},
		{name: "miss", matches: []domain.MatchResult{mk("ent_ccccccccccccc")}, seedIDs: []string{"ent_aaaaaaaaaaaaa"}, want: 0},
		{name: "dedup", matches: []domain.MatchResult{mk("ent_aaaaaaaaaaaaa"), mk("ent_aaaaaaaaaaaaa")}, seedIDs: []string{"ent_aaaaaaaaaaaaa"}, want: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var repo storage.EntityRepository
			if !tt.nilRepo {
				r := storage.NewInMemoryEntityRepo()
				seed(r, tt.seedIDs...)
				repo = r
			}
			got := hydrateMatchEntities(tt.matches, repo)
			if len(got) != tt.want {
				t.Errorf("len=%d want=%d", len(got), tt.want)
			}
		})
	}
}
