// Asserts the Day 7 + Day 13 admin routes are mounted on the main
// chi router. The contract: a registered route, hit without auth,
// must return 401 (auth required by chain) — never 404 (route
// missing). That distinction proves MountAdminRoutes did its job.
package main

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRouter_AdminRateLimits_Mounted(t *testing.T) {
	ts := newRouterServer(t, nil)
	tenantID := uuid.New().String()
	url := ts.URL + "/admin/tenants/" + tenantID + "/rate-limits"

	resp, err := http.Get(url)
	require.NoError(t, err)
	resp.Body.Close()
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode,
		"GET /admin/tenants/{id}/rate-limits must be registered")

	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader([]byte(`{"rules":[]}`)))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode,
		"PUT /admin/tenants/{id}/rate-limits must be registered")
}

func TestRouter_AdminAuditLogs_Mounted(t *testing.T) {
	ts := newRouterServer(t, nil)
	resp, err := http.Get(ts.URL + "/admin/audit-logs")
	require.NoError(t, err)
	resp.Body.Close()
	assert.NotEqual(t, http.StatusNotFound, resp.StatusCode,
		"GET /admin/audit-logs must be registered")
}
