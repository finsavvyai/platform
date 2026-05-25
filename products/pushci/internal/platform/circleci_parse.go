package platform

import "strings"

// parseCircleCIPayload converts a CircleCI v2 webhook payload into a
// normalized Event. Handles "workflow-completed" and "job-completed".
//
// CircleCI project slugs look like "gh/acme/repo" or "bb/acme/repo".
// We strip the VCS prefix so Repo matches the GitHub/Bitbucket form
// used by other providers ("acme/repo").
func parseCircleCIPayload(raw map[string]interface{}) *Event {
	e := &Event{Provider: "circleci"}
	e.Action = str(raw["type"]) // "workflow-completed" or "job-completed"

	if proj, ok := raw["project"].(map[string]interface{}); ok {
		e.Repo = stripVCSPrefix(str(proj["slug"]))
	}
	if org, ok := raw["organization"].(map[string]interface{}); ok && e.Repo == "" {
		e.Repo = str(org["name"])
	}

	if pipe, ok := raw["pipeline"].(map[string]interface{}); ok {
		if vcs, ok := pipe["vcs"].(map[string]interface{}); ok {
			e.SHA = str(vcs["revision"])
			e.Branch = str(vcs["branch"])
			e.CloneURL = str(vcs["origin_repository_url"])
		}
		if trig, ok := pipe["trigger"].(map[string]interface{}); ok {
			if actor, ok := trig["actor"].(map[string]interface{}); ok {
				e.Sender = str(actor["login"])
			}
		}
	}
	return e
}

// stripVCSPrefix turns "gh/acme/repo" into "acme/repo". CircleCI
// prefixes slugs with the VCS code ("gh", "bb", "circleci"). Leave
// unprefixed slugs alone.
func stripVCSPrefix(slug string) string {
	parts := strings.SplitN(slug, "/", 3)
	if len(parts) == 3 {
		switch parts[0] {
		case "gh", "bb", "circleci", "github", "bitbucket":
			return parts[1] + "/" + parts[2]
		}
	}
	return slug
}
