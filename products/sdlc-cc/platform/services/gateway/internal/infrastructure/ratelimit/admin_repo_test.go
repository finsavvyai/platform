package ratelimit

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestValidateRule_HappyPath(t *testing.T) {
	cases := []Rule{
		{RoutePattern: "/v1/rag/query", RequestsPerMinute: 10, Burst: 5},
		{RoutePattern: "*", RequestsPerMinute: 1000, Burst: 100},
		{RoutePattern: "/v1/documents/*", RequestsPerMinute: 60, Burst: 60},
	}
	for i, rule := range cases {
		if err := ValidateRule(rule); err != nil {
			t.Fatalf("case %d should pass: %v (rule=%+v)", i, err, rule)
		}
	}
}

func TestValidateRule_RejectsBadInputs(t *testing.T) {
	cases := []struct {
		name string
		rule Rule
	}{
		{"empty pattern", Rule{RoutePattern: "", RequestsPerMinute: 10, Burst: 5}},
		{"missing slash", Rule{RoutePattern: "no-slash", RequestsPerMinute: 10, Burst: 5}},
		{"limit zero", Rule{RoutePattern: "/v1/q", RequestsPerMinute: 0, Burst: 5}},
		{"burst zero", Rule{RoutePattern: "/v1/q", RequestsPerMinute: 10, Burst: 0}},
		{"burst above 10x limit", Rule{RoutePattern: "/v1/q", RequestsPerMinute: 10, Burst: 200}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateRule(tc.rule)
			if err == nil {
				t.Fatalf("must error for %s", tc.name)
			}
			if !IsInvalidRule(err) {
				t.Fatalf("must be ErrInvalidRule, got %T: %v", err, err)
			}
		})
	}
}

func TestAdminRepo_List_ReturnsRowsInPatternOrder(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	defer func() { _ = db.Close() }()
	repo := NewAdminRepo(db, nil)
	tenantID := uuid.New()

	rows := sqlmock.NewRows([]string{"tenant_id", "route_pattern", "requests_per_minute", "burst"}).
		AddRow(tenantID, "*", 1000, 100).
		AddRow(tenantID, "/v1/rag/query", 60, 10)
	mock.ExpectQuery(
		"SELECT tenant_id, route_pattern, requests_per_minute, burst " +
			"FROM rate_limits WHERE tenant_id = $1 ORDER BY route_pattern",
	).WithArgs(tenantID).WillReturnRows(rows)

	got, err := repo.List(context.Background(), tenantID)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 rows, got %d", len(got))
	}
	if got[0].RoutePattern != "*" || got[1].RoutePattern != "/v1/rag/query" {
		t.Fatalf("unexpected order: %+v", got)
	}
}

func TestAdminRepo_Replace_DeletesThenInserts_InvalidatesCache(t *testing.T) {
	db, mock, _ := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	defer func() { _ = db.Close() }()

	cache := NewConfigRepo(db, 0)
	repo := NewAdminRepo(db, cache)
	tenantID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM rate_limits WHERE tenant_id = $1").
		WithArgs(tenantID).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(
		"INSERT INTO rate_limits (tenant_id, route_pattern, requests_per_minute, burst) " +
			"VALUES ($1, $2, $3, $4)",
	).WithArgs(tenantID, "/v1/q", 30, 5).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	if err := repo.Replace(context.Background(), tenantID, []Rule{
		{TenantID: tenantID, RoutePattern: "/v1/q", RequestsPerMinute: 30, Burst: 5},
	}); err != nil {
		t.Fatalf("Replace: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sqlmock expectations: %v", err)
	}
}

func TestAdminRepo_Replace_RejectsInvalidBeforeDB(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer func() { _ = db.Close() }()
	repo := NewAdminRepo(db, nil)
	err := repo.Replace(context.Background(), uuid.New(), []Rule{
		{RoutePattern: "no-slash", RequestsPerMinute: 1, Burst: 1},
	})
	if !IsInvalidRule(err) {
		t.Fatalf("must reject before any DB call: %v", err)
	}
}
