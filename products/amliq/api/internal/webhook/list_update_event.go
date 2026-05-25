package webhook

import (
	"encoding/json"
	"fmt"
	"time"
)

// ListUpdateEvent describes a sanctions list change.
type ListUpdateEvent struct {
	ListID           string    `json:"list_id"`
	ListName         string    `json:"list_name"`
	ChangedAt        time.Time `json:"changed_at"`
	EntitiesAdded    int       `json:"entities_added"`
	EntitiesRemoved  int       `json:"entities_removed"`
	EntitiesModified int       `json:"entities_modified"`
}

// FormatWebhookPayload serializes the event as a JSON webhook payload.
func FormatWebhookPayload(event ListUpdateEvent) []byte {
	payload := map[string]interface{}{
		"event":             "list.updated",
		"list_id":           event.ListID,
		"list_name":         event.ListName,
		"changed_at":        event.ChangedAt.UTC().Format(time.RFC3339),
		"entities_added":    event.EntitiesAdded,
		"entities_removed":  event.EntitiesRemoved,
		"entities_modified": event.EntitiesModified,
	}
	data, _ := json.Marshal(payload)
	return data
}

// FormatSlackPayload creates a Slack Block Kit message for the event.
func FormatSlackPayload(event ListUpdateEvent) []byte {
	summary := fmt.Sprintf(
		":rotating_light: *%s* updated at %s\n+%d added, -%d removed, ~%d modified",
		event.ListName,
		event.ChangedAt.UTC().Format("2006-01-02 15:04 UTC"),
		event.EntitiesAdded,
		event.EntitiesRemoved,
		event.EntitiesModified,
	)
	msg := map[string]interface{}{
		"blocks": []map[string]interface{}{
			{
				"type": "section",
				"text": map[string]string{
					"type": "mrkdwn",
					"text": summary,
				},
			},
		},
	}
	data, _ := json.Marshal(msg)
	return data
}

// FormatEmailBody generates an HTML email body for the event.
func FormatEmailBody(event ListUpdateEvent) string {
	return fmt.Sprintf(
		`<h2>Sanctions List Update: %s</h2>
<p>The <strong>%s</strong> list was updated at %s.</p>
<table>
<tr><td>Entities Added</td><td>%d</td></tr>
<tr><td>Entities Removed</td><td>%d</td></tr>
<tr><td>Entities Modified</td><td>%d</td></tr>
</table>
<p>Please review any new alerts in your AMLIQ dashboard.</p>`,
		event.ListName,
		event.ListName,
		event.ChangedAt.UTC().Format("2006-01-02 15:04 UTC"),
		event.EntitiesAdded,
		event.EntitiesRemoved,
		event.EntitiesModified,
	)
}
