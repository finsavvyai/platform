package siem

import (
	"fmt"
	"strings"

	"github.com/finsavvyai/pipewarden/internal/analysis"
)

func (s *SlackNotifier) buildFindingPayload(f analysis.Finding, dashURL string) map[string]interface{} {
	username := s.config.Username
	if username == "" {
		username = "PipeWarden"
	}

	emoji := severityEmoji(f.Severity)
	color := severityColor(f.Severity)

	blocks := []map[string]interface{}{
		{
			"type": "header",
			"text": map[string]interface{}{
				"type": "plain_text",
				"text": fmt.Sprintf("%s %s Security Finding", emoji, strings.ToUpper(string(f.Severity))),
			},
		},
		{
			"type": "section",
			"text": map[string]interface{}{
				"type": "mrkdwn",
				"text": fmt.Sprintf("*%s*\n%s", f.Title, f.Description),
			},
		},
		{
			"type": "section",
			"fields": []map[string]interface{}{
				{"type": "mrkdwn", "text": fmt.Sprintf("*Connection*\n%s", f.ConnectionName)},
				{"type": "mrkdwn", "text": fmt.Sprintf("*Category*\n%s", f.Category)},
				{"type": "mrkdwn", "text": fmt.Sprintf("*Confidence*\n%.0f%%", f.Confidence*100)},
				{"type": "mrkdwn", "text": fmt.Sprintf("*Status*\n%s", f.Status)},
			},
		},
	}

	if f.Remediation != "" {
		blocks = append(blocks, map[string]interface{}{
			"type": "section",
			"text": map[string]interface{}{
				"type": "mrkdwn",
				"text": fmt.Sprintf("*Remediation*\n%s", f.Remediation),
			},
		})
	}

	if dashURL != "" {
		blocks = append(blocks, map[string]interface{}{
			"type": "actions",
			"elements": []map[string]interface{}{
				{
					"type":  "button",
					"text":  map[string]interface{}{"type": "plain_text", "text": "View Finding"},
					"url":   dashURL,
					"style": "danger",
				},
			},
		})
	}

	payload := map[string]interface{}{
		"username":    username,
		"icon_emoji":  ":shield:",
		"attachments": []map[string]interface{}{{"color": color, "blocks": blocks}},
	}
	if s.config.Channel != "" {
		payload["channel"] = s.config.Channel
	}
	return payload
}

func (s *SlackNotifier) buildBatchPayload(findings []analysis.Finding, connName, runID, dashURL string) map[string]interface{} {
	username := s.config.Username
	if username == "" {
		username = "PipeWarden"
	}

	counts := map[string]int{}
	for _, f := range findings {
		counts[string(f.Severity)]++
	}

	summary := fmt.Sprintf(
		"*%d findings* in connection `%s` (run `%s`)\n:red_circle: Critical: %d  :large_orange_circle: High: %d  :large_yellow_circle: Medium: %d  :white_circle: Low: %d",
		len(findings), connName, runID,
		counts["critical"], counts["high"], counts["medium"], counts["low"],
	)

	blocks := []map[string]interface{}{
		{"type": "header", "text": map[string]interface{}{"type": "plain_text", "text": ":shield: PipeWarden Scan Complete"}},
		{"type": "section", "text": map[string]interface{}{"type": "mrkdwn", "text": summary}},
	}

	if dashURL != "" {
		blocks = append(blocks, map[string]interface{}{
			"type": "actions",
			"elements": []map[string]interface{}{
				{"type": "button", "text": map[string]interface{}{"type": "plain_text", "text": "Open Dashboard"}, "url": dashURL},
			},
		})
	}

	payload := map[string]interface{}{
		"username":   username,
		"icon_emoji": ":shield:",
		"blocks":     blocks,
	}
	if s.config.Channel != "" {
		payload["channel"] = s.config.Channel
	}
	return payload
}
