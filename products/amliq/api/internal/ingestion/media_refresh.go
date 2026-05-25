package ingestion

import (
	"context"
	"log"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

// MediaRefreshResult summarises one refresh tick for observability.
type MediaRefreshResult struct {
	StartedAt time.Time
	Duration  time.Duration
	Articles  int
	Entities  int
	Err       string
}

// MediaStore is the narrow contract MediaRefresher needs from
// persistence. Lives here to avoid pulling the full storage package
// surface into ingestion's runtime dependency tree.
type MediaStore interface {
	UpsertEntities(ctx context.Context, ents []domain.Entity) error
}

// MediaRefresher pulls fresh GDELT GKG records, converts AML-relevant
// entries into domain entities, and upserts them through the store.
// Designed to run from cmd/worker on a 30-minute interval — that
// matches GDELT's 15-minute publication cadence with a safety margin.
type MediaRefresher struct {
	store    MediaStore
	interval time.Duration
}

func NewMediaRefresher(store MediaStore) *MediaRefresher {
	return &MediaRefresher{store: store, interval: 30 * time.Minute}
}

// Run blocks until ctx is cancelled, ticking every `interval`. The
// first tick fires immediately so a freshly-started worker is not
// silent for half an hour.
func (r *MediaRefresher) Run(ctx context.Context) {
	t := time.NewTicker(r.interval)
	defer t.Stop()
	r.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.tick(ctx)
		}
	}
}

func (r *MediaRefresher) tick(ctx context.Context) MediaRefreshResult {
	start := time.Now().UTC()
	articles, err := FetchLatestGKG(ctx)
	if err != nil {
		log.Printf("media-refresh: fetch failed: %v", err)
		return MediaRefreshResult{
			StartedAt: start, Duration: time.Since(start),
			Err: err.Error(),
		}
	}
	ents := mediaArticlesToEntities(articles)
	if r.store != nil && len(ents) > 0 {
		if err := r.store.UpsertEntities(ctx, ents); err != nil {
			log.Printf("media-refresh: upsert failed: %v", err)
			return MediaRefreshResult{
				StartedAt: start, Duration: time.Since(start),
				Articles: len(articles), Err: err.Error(),
			}
		}
	}
	res := MediaRefreshResult{
		StartedAt: start, Duration: time.Since(start),
		Articles: len(articles), Entities: len(ents),
	}
	log.Printf("media-refresh: ok articles=%d entities=%d in %v",
		res.Articles, res.Entities, res.Duration)
	return res
}

func mediaArticlesToEntities(articles []GDELTArticle) []domain.Entity {
	out := make([]domain.Entity, 0, len(articles)*2)
	seen := make(map[string]struct{})
	for _, a := range articles {
		for _, p := range a.Persons {
			if e, ok := buildSimpleMediaEntity(p, "person", a.URL, seen); ok {
				out = append(out, e)
			}
		}
		for _, o := range a.Orgs {
			if e, ok := buildSimpleMediaEntity(o, "organization", a.URL, seen); ok {
				out = append(out, e)
			}
		}
	}
	return out
}

func buildSimpleMediaEntity(
	rawName, kind, sourceURL string, seen map[string]struct{},
) (domain.Entity, bool) {
	if rawName == "" {
		return domain.Entity{}, false
	}
	key := kind + ":" + rawName
	if _, dup := seen[key]; dup {
		return domain.Entity{}, false
	}
	seen[key] = struct{}{}
	ent, err := buildMediaEntity(extractedEntity{
		Name: rawName, Type: kind, Role: "gdelt-gkg",
	})
	if err != nil {
		return domain.Entity{}, false
	}
	ent.Metadata["source_url"] = sourceURL
	return ent, true
}
