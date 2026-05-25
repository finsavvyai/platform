package platform

func parseGitLabPayload(raw map[string]interface{}) *Event {
	e := &Event{Provider: "gitlab"}
	kind := str(raw["object_kind"])

	proj, _ := raw["project"].(map[string]interface{})
	if proj != nil {
		e.Repo = str(proj["path_with_namespace"])
		e.CloneURL = str(proj["git_http_url"])
	}
	user, _ := raw["user"].(map[string]interface{})
	if user != nil {
		e.Sender = str(user["username"])
	}

	switch kind {
	case "push":
		e.Action = "push"
		e.SHA = str(raw["after"])
		ref := str(raw["ref"])
		if len(ref) > 11 {
			e.Branch = ref[11:]
		}
	case "merge_request":
		e.Action = "merge_request"
		attrs, _ := raw["object_attributes"].(map[string]interface{})
		if attrs != nil {
			src, _ := attrs["source"].(map[string]interface{})
			if src != nil {
				e.SHA = str(attrs["last_commit"])
			}
			e.PRNumber = intVal(attrs["iid"])
			e.Branch = str(attrs["source_branch"])
		}
	}
	return e
}
