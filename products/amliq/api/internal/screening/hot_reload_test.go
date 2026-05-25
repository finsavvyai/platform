package screening

import (
	"sync"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func mustEnt(id, name string) domain.Entity {
	eid, _ := domain.NewEntityID(id)
	n, _ := domain.NewName(name, "", "", "")
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{n})
	return e
}

func TestHotReload(t *testing.T) {
	tests := []struct {
		name       string
		initial    []domain.Entity
		added      []domain.Entity
		removedIDs []string
		wantCount  int
	}{
		{
			name:       "add new entity to empty index",
			initial:    nil,
			added:      []domain.Entity{mustEnt("ent_aaaaaaaaaaaa", "John Smith")},
			removedIDs: nil,
			wantCount:  1,
		},
		{
			name:       "remove entity from index",
			initial:    []domain.Entity{mustEnt("ent_aaaaaaaaaaaa", "John Smith")},
			added:      nil,
			removedIDs: []string{"ent_aaaaaaaaaaaa"},
			wantCount:  0,
		},
		{
			name: "add and remove simultaneously",
			initial:    []domain.Entity{mustEnt("ent_aaaaaaaaaaaa", "Alice Jones")},
			added:      []domain.Entity{mustEnt("ent_bbbbbbbbbbbb", "Bob Brown")},
			removedIDs: []string{"ent_aaaaaaaaaaaa"},
			wantCount:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			idx := NewSearchIndex()
			if len(tt.initial) > 0 {
				idx.Load(tt.initial)
			}

			HotReload(idx, tt.added, tt.removedIDs)

			if got := EntityCount(idx); got != tt.wantCount {
				t.Errorf("EntityCount = %d, want %d", got, tt.wantCount)
			}
		})
	}
}

func TestHotReloadConcurrentReads(t *testing.T) {
	idx := NewSearchIndex()
	idx.Load([]domain.Entity{mustEnt("ent_aaaaaaaaaaaa", "Test Person")})

	var wg sync.WaitGroup
	stop := make(chan struct{})

	// Concurrent readers
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-stop:
					return
				default:
					idx.Search("Test", SearchOpts{Limit: 5})
				}
			}
		}()
	}

	// Perform hot reload while readers are active
	newEnt := mustEnt("ent_bbbbbbbbbbbb", "New Entity")
	HotReload(idx, []domain.Entity{newEnt}, nil)

	time.Sleep(20 * time.Millisecond)
	close(stop)
	wg.Wait()

	if got := EntityCount(idx); got != 2 {
		t.Errorf("EntityCount after concurrent reload = %d, want 2", got)
	}
}
