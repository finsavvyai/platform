package mesh

import "net/http"

// HTTPClientSetter is the small subset of every provider's API surface that
// lets us inject an *http.Client built by the mesh. All six PipeWarden
// CI/CD provider clients (github, gitlab, bitbucket, jenkins, azure,
// circleci) implement SetHTTPClient(*http.Client).
type HTTPClientSetter interface {
	SetHTTPClient(*http.Client)
}

// Apply injects the mesh's *http.Client into target if (a) the mesh is
// active and (b) target satisfies HTTPClientSetter. Returns true when the
// injection happened. Safe to call with any value — non-conforming types
// are ignored so callers do not need a type switch.
func Apply(target any) bool {
	if !Active() {
		return false
	}
	setter, ok := target.(HTTPClientSetter)
	if !ok {
		return false
	}
	setter.SetHTTPClient(Client())
	return true
}
