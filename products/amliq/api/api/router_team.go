package api

import "net/http"

func setupTeamRoutes(
	mux *http.ServeMux,
	deps *Dependencies,
	authChain func(http.Handler) http.Handler,
) {
	if deps.Seats == nil {
		return
	}
	teamAdmin := AdminOnly()
	th := NewTeamHandler(deps.Seats)
	tr := NewTeamRoleHandler(deps.Seats)

	mux.Handle("GET /api/v1/team",
		authChain(http.HandlerFunc(th.ListMembers)))
	mux.Handle("POST /api/v1/team/invite",
		authChain(teamAdmin(http.HandlerFunc(th.InviteUser))))
	mux.Handle("PUT /api/v1/team/{id}/role",
		authChain(teamAdmin(http.HandlerFunc(tr.UpdateRole))))
	mux.Handle("DELETE /api/v1/team/{id}",
		authChain(teamAdmin(http.HandlerFunc(th.RemoveMember))))

	// Manager-facing AI usage report. AdminOnly because analysts
	// shouldn't see each other's AI activity — that's a compliance-
	// manager / supervisor view by design.
	if deps.Audit != nil {
		mux.Handle("GET /api/v1/team/ai-usage",
			authChain(teamAdmin(handleTeamAIUsage(deps.Audit))))
	}
}
