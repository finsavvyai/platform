package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/finsavvyai/pushci/internal/cli"
)

// skillStatsAPIBase is overridable from tests. Defaults to the production API.
var skillStatsAPIBase = apiBase

type skillStats struct {
	SkillID       string        `json:"skill_id"`
	UpvotesCount  int           `json:"upvotes_count"`
	CommentsCount int           `json:"comments_count"`
	UsageCount30d int           `json:"usage_count_30d"`
	UsageCountAll int           `json:"usage_count_all_time"`
	MyUsageCount  int           `json:"my_usage_count"`
	TopUsers30d   []skillTopUse `json:"top_users_30d"`
}

type skillTopUse struct {
	UserSub string `json:"user_sub"`
	Uses    int    `json:"uses"`
}

func cmdSkillStats(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: pushci skill stats <skill-id>")
	}
	id := strings.TrimSpace(args[0])
	cli.Header(fmt.Sprintf("Skill stats: %s", id))
	cfg := loadConfig()
	stats, err := fetchSkillStats(id, cfg)
	if err != nil {
		if cfg == nil || cfg.Token == "" {
			cli.Warn("Offline or not logged in. Login to see global stats:")
			cli.Info("  " + cli.Blue("pushci login"))
			return nil
		}
		return err
	}
	renderSkillStats(stats, cfg != nil && cfg.Token != "")
	return nil
}

func fetchSkillStats(id string, cfg *pushciConfig) (*skillStats, error) {
	req, err := http.NewRequest(http.MethodGet, // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
		fmt.Sprintf("%s/api/skills/%s/stats", skillStatsAPIBase, id), nil)
	if err != nil {
		return nil, err
	}
	if cfg != nil && cfg.Token != "" {
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
	}
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req) // #nosec G703 G704 G122 -- CLI tool: paths/URLs are user-supplied
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("stats %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out skillStats
	return &out, json.NewDecoder(resp.Body).Decode(&out)
}

func renderSkillStats(s *skillStats, authed bool) {
	g := func(n int) string { return cli.Green(fmt.Sprintf("%d", n)) }
	fmt.Printf("  %-22s %s\n", cli.Dim("Upvotes"), g(s.UpvotesCount))
	fmt.Printf("  %-22s %s\n", cli.Dim("Comments"), g(s.CommentsCount))
	fmt.Printf("  %-22s %s\n", cli.Dim("Uses (30d)"), g(s.UsageCount30d))
	fmt.Printf("  %-22s %s\n", cli.Dim("Uses (all time)"), g(s.UsageCountAll))
	if authed {
		fmt.Printf("  %-22s %s\n", cli.Dim("Your usage"), cli.Blue(fmt.Sprintf("%d", s.MyUsageCount)))
	} else {
		cli.Info("Login to see your own usage count: " + cli.Blue("pushci login"))
	}
	if len(s.TopUsers30d) > 0 {
		fmt.Println()
		cli.Info("Top users (30d):")
		for _, u := range s.TopUsers30d {
			sub := u.UserSub
			if len(sub) > 24 {
				sub = sub[:22] + "…"
			}
			fmt.Printf("    %s  %d uses\n", cli.Blue(sub), u.Uses)
		}
	}
}
