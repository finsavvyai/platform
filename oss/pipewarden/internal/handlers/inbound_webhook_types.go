package handlers

// GitHubPushPayload is the minimal push event payload from GitHub webhooks.
type GitHubPushPayload struct {
	Ref        string `json:"ref"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

// GitHubPRPayload is the minimal pull_request event payload from GitHub webhooks.
type GitHubPRPayload struct {
	Action      string `json:"action"`
	PullRequest struct {
		Number int `json:"number"`
		Head   struct {
			Ref string `json:"ref"`
		} `json:"head"`
	} `json:"pull_request"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

// GitLabPushPayload is the minimal Push Hook payload from GitLab webhooks.
type GitLabPushPayload struct {
	Ref     string `json:"ref"`
	Project struct {
		PathWithNamespace string `json:"path_with_namespace"`
	} `json:"project"`
}

// GitLabMRPayload is the minimal Merge Request Hook payload from GitLab webhooks.
type GitLabMRPayload struct {
	ObjectAttributes struct {
		SourceBranch string `json:"source_branch"`
		IID          int    `json:"iid"`
	} `json:"object_attributes"`
	Project struct {
		PathWithNamespace string `json:"path_with_namespace"`
	} `json:"project"`
}
