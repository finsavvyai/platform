package migrate

// EnvVarRef is a variable referenced in the pipeline that needs to be set.
type EnvVarRef struct {
	Name       string
	Source     string // "gitlab-ci-var", "script-ref", "job-var"
	UsedIn     string // job/stage name
	IsSecret   bool
	Suggestion string // how to set it in PushCI
}
