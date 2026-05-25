package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFetchSkillStats(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/api/skills/heal/stats") {
			http.NotFound(w, r)
			return
		}
		if got := r.Header.Get("Authorization"); got != "Bearer tok-abc" {
			http.Error(w, "nope", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(skillStats{
			SkillID: "heal", UpvotesCount: 12, CommentsCount: 3,
			UsageCount30d: 42, UsageCountAll: 200, MyUsageCount: 7,
			TopUsers30d: []skillTopUse{{UserSub: "github:1", Uses: 10}},
		})
	}))
	defer srv.Close()
	orig := skillStatsAPIBase
	skillStatsAPIBase = srv.URL
	defer func() { skillStatsAPIBase = orig }()

	s, err := fetchSkillStats("heal", &pushciConfig{Token: "tok-abc"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.UpvotesCount != 12 || s.UsageCountAll != 200 || s.MyUsageCount != 7 {
		t.Fatalf("bad payload decoding: %+v", s)
	}
	if len(s.TopUsers30d) != 1 || s.TopUsers30d[0].Uses != 10 {
		t.Fatalf("bad top users: %+v", s.TopUsers30d)
	}
}

func TestFetchSkillStatsNoAuth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Errorf("unexpected auth header sent without token")
		}
		_ = json.NewEncoder(w).Encode(skillStats{SkillID: "heal", UpvotesCount: 5})
	}))
	defer srv.Close()
	orig := skillStatsAPIBase
	skillStatsAPIBase = srv.URL
	defer func() { skillStatsAPIBase = orig }()

	s, err := fetchSkillStats("heal", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.UpvotesCount != 5 || s.MyUsageCount != 0 {
		t.Fatalf("unexpected decoded payload: %+v", s)
	}
}

func TestFetchSkillStatsServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()
	orig := skillStatsAPIBase
	skillStatsAPIBase = srv.URL
	defer func() { skillStatsAPIBase = orig }()

	if _, err := fetchSkillStats("heal", nil); err == nil {
		t.Fatalf("expected error on 500, got nil")
	}
}

func TestCmdSkillStatsNoArgs(t *testing.T) {
	if err := cmdSkillStats(nil); err == nil {
		t.Fatalf("expected usage error when no skill id provided")
	}
}
