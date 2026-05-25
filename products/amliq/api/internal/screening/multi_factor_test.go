package screening

import (
	"math"
	"testing"
	"time"

	"github.com/aegis-aml/aegis/internal/domain"
)

func makeMFEntity(
	id string, dob *time.Time, nats []string, ids []domain.Identifier, addrs []string,
) domain.Entity {
	name, _ := domain.NewName("Test Name", "Test", "Name", "")
	eid, _ := domain.NewEntityID(id)
	e, _ := domain.NewEntity(eid, domain.EntityTypeIndividual, []domain.Name{name})
	e.DOB = dob
	e.Nationalities = nats
	e.Identifiers = ids
	e.Addresses = addrs
	return e
}

func approxEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestDOBMatchBoostsScore(t *testing.T) {
	dob := time.Date(1985, 6, 15, 0, 0, 0, 0, time.UTC)
	q := makeMFEntity("q1", &dob, nil, nil, nil)
	c := makeMFEntity("c1", &dob, nil, nil, nil)
	score := MultiFactorScore(q, c, 0.60)
	if !approxEqual(score, 0.80) {
		t.Errorf("expected 0.80, got %.4f", score)
	}
}

func TestDOBContradictionPenalizes(t *testing.T) {
	d1 := time.Date(1985, 6, 15, 0, 0, 0, 0, time.UTC)
	d2 := time.Date(1990, 3, 20, 0, 0, 0, 0, time.UTC)
	q := makeMFEntity("q1", &d1, nil, nil, nil)
	c := makeMFEntity("c1", &d2, nil, nil, nil)
	score := MultiFactorScore(q, c, 0.60)
	if !approxEqual(score, 0.45) {
		t.Errorf("expected 0.45, got %.4f", score)
	}
}

func TestMultipleFactorsCompound(t *testing.T) {
	dob := time.Date(1985, 6, 15, 0, 0, 0, 0, time.UTC)
	id, _ := domain.NewIdentifier(domain.IDPassport, "AB123456", "SY")
	q := makeMFEntity("q1", &dob, []string{"SY"}, []domain.Identifier{id}, nil)
	c := makeMFEntity("c1", &dob, []string{"SY"}, []domain.Identifier{id}, nil)
	score := MultiFactorScore(q, c, 0.50)
	if !approxEqual(score, 1.0) {
		t.Errorf("expected 1.0 (capped), got %.4f", score)
	}
}

func TestScoreCappedAtOne(t *testing.T) {
	dob := time.Date(1985, 6, 15, 0, 0, 0, 0, time.UTC)
	q := makeMFEntity("q1", &dob, []string{"SY"}, nil, []string{"Damascus"})
	c := makeMFEntity("c1", &dob, []string{"SY"}, nil, []string{"Damascus"})
	score := MultiFactorScore(q, c, 0.80)
	if !approxEqual(score, 1.0) {
		t.Errorf("expected 1.0 (capped), got %.4f", score)
	}
}

func TestNoFactorsUnchanged(t *testing.T) {
	q := makeMFEntity("q1", nil, nil, nil, nil)
	c := makeMFEntity("c1", nil, nil, nil, nil)
	score := MultiFactorScore(q, c, 0.55)
	if !approxEqual(score, 0.55) {
		t.Errorf("expected 0.55, got %.4f", score)
	}
}

func TestNationalityContradiction(t *testing.T) {
	q := makeMFEntity("q1", nil, []string{"US"}, nil, nil)
	c := makeMFEntity("c1", nil, []string{"RU"}, nil, nil)
	score := MultiFactorScore(q, c, 0.60)
	if !approxEqual(score, 0.50) {
		t.Errorf("expected 0.50, got %.4f", score)
	}
}
