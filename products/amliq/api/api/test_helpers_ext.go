package api

import (
	"context"
	"net/http"
	"net/http/httptest"
)

func newTenantRequest(method, path string, tenantID string) *http.Request {
	req := httptest.NewRequest(method, path, nil)
	ctx := context.WithValue(req.Context(), TenantContextKey, tenantID)
	return req.WithContext(ctx)
}

func newTenantRequestBody(method, path, tenantID string, body *http.Request) *http.Request {
	ctx := context.WithValue(body.Context(), TenantContextKey, tenantID)
	return body.WithContext(ctx)
}
