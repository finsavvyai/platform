package platform

func parseGitHubPayload(eventType string, raw map[string]interface{}) *Event {
	e := &Event{Provider: "github"}

	repo, _ := nested(raw, "repository", "full_name")
	e.Repo = str(repo)
	sender, _ := nested(raw, "sender", "login")
	e.Sender = str(sender)
	cloneURL, _ := nested(raw, "repository", "clone_url")
	e.CloneURL = str(cloneURL)

	switch eventType {
	case "push":
		e.Action = "push"
		e.SHA = str(raw["after"])
		ref := str(raw["ref"])
		if len(ref) > 11 {
			e.Branch = ref[11:] // strip "refs/heads/"
		}
	case "pull_request":
		e.Action = "pull_request"
		pr, _ := raw["pull_request"].(map[string]interface{})
		if pr != nil {
			head, _ := pr["head"].(map[string]interface{})
			if head != nil {
				e.SHA = str(head["sha"])
				e.Branch = str(head["ref"])
			}
			e.PRNumber = intVal(pr["number"])
		}
	}
	return e
}

func nested(m map[string]interface{}, keys ...string) (interface{}, bool) {
	var v interface{} = m
	for _, k := range keys {
		mm, ok := v.(map[string]interface{})
		if !ok {
			return nil, false
		}
		v = mm[k]
	}
	return v, v != nil
}

func str(v interface{}) string {
	s, _ := v.(string)
	return s
}

func intVal(v interface{}) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	}
	return 0
}
