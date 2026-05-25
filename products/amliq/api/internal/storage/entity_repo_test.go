package storage

import (
	"testing"

	"github.com/aegis-aml/aegis/internal/domain"
)

func TestInMemoryEntityRepo(t *testing.T) {
	repo := NewInMemoryEntityRepo()
	id, _ := domain.NewEntityID("ent_000000000001")
	name, _ := domain.NewName("John Smith", "John", "Smith", "")
	entity, _ := domain.NewEntity(id, domain.EntityTypeIndividual, []domain.Name{name})

	tests := []struct {
		name        string
		fn          func() error
		shouldErr   bool
		checkResult func() bool
	}{
		{
			name: "create_and_get",
			fn: func() error {
				repo.Create(entity)
				_, err := repo.GetByID(id)
				return err
			},
			shouldErr: false,
			checkResult: func() bool {
				got, _ := repo.GetByID(id)
				return got != nil && got.ID.String() == id.String()
			},
		},
		{
			name: "get_nonexistent",
			fn:   func() error { return nil },
			checkResult: func() bool {
				badID, _ := domain.NewEntityID("ent_999999999999")
				got, _ := repo.GetByID(badID)
				return got == nil
			},
		},
		{
			name: "delete",
			fn: func() error {
				repo.Create(entity)
				return repo.Delete(id)
			},
			shouldErr: false,
			checkResult: func() bool {
				got, _ := repo.GetByID(id)
				return got == nil
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.fn()
			if (err != nil) != tt.shouldErr {
				t.Errorf("error = %v, shouldErr = %v", err, tt.shouldErr)
			}
			if !tt.checkResult() {
				t.Errorf("result check failed")
			}
		})
	}
}
