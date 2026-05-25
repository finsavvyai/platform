package platform

// parseAzurePayload normalizes Azure DevOps service-hook payloads into
// an Event. Supported event types:
//
//   - git.push                        → push
//   - git.pullrequest.created/updated → pull_request
//   - ms.vss-pipelines.run-state-changed-event (passthrough metadata)
//
// Repo is encoded as "{project}/{repositoryId}" so the API layer can
// split it back out for the REST v7.0 URL template, which requires
// both segments.
func parseAzurePayload(raw map[string]interface{}) *Event {
	e := &Event{Provider: "azure"}
	eventType := str(raw["eventType"])
	resource, _ := raw["resource"].(map[string]interface{})
	if resource == nil {
		e.Action = eventType
		return e
	}
	setAzureRepo(e, resource)
	setAzureSender(e, resource)

	switch eventType {
	case "git.push":
		e.Action = "push"
		fillAzurePush(e, resource)
	case "git.pullrequest.created", "git.pullrequest.updated":
		e.Action = "pull_request"
		fillAzurePR(e, resource)
	default:
		e.Action = eventType
	}
	return e
}

func setAzureRepo(e *Event, resource map[string]interface{}) {
	repo, _ := resource["repository"].(map[string]interface{})
	if repo == nil {
		return
	}
	project, _ := repo["project"].(map[string]interface{})
	projectName := ""
	if project != nil {
		projectName = str(project["name"])
	}
	e.Repo = projectName + "/" + str(repo["id"])
	e.CloneURL = str(repo["remoteUrl"])
}

func setAzureSender(e *Event, resource map[string]interface{}) {
	if by, ok := resource["pushedBy"].(map[string]interface{}); ok {
		e.Sender = str(by["displayName"])
		return
	}
	if by, ok := resource["createdBy"].(map[string]interface{}); ok {
		e.Sender = str(by["displayName"])
	}
}

func fillAzurePush(e *Event, resource map[string]interface{}) {
	refs, _ := resource["refUpdates"].([]interface{})
	if len(refs) > 0 {
		if ref, ok := refs[0].(map[string]interface{}); ok {
			name := str(ref["name"])
			if len(name) > 11 && name[:11] == "refs/heads/" {
				e.Branch = name[11:]
			}
			if s := str(ref["newObjectId"]); s != "" {
				e.SHA = s
			}
		}
	}
	commits, _ := resource["commits"].([]interface{})
	if len(commits) > 0 && e.SHA == "" {
		if c, ok := commits[0].(map[string]interface{}); ok {
			e.SHA = str(c["commitId"])
		}
	}
}

func fillAzurePR(e *Event, resource map[string]interface{}) {
	e.PRNumber = intVal(resource["pullRequestId"])
	ref := str(resource["sourceRefName"])
	if len(ref) > 11 && ref[:11] == "refs/heads/" {
		e.Branch = ref[11:]
	}
	last, _ := resource["lastMergeSourceCommit"].(map[string]interface{})
	if last != nil {
		e.SHA = str(last["commitId"])
	}
}
