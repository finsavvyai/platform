import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { OPENAPI_SPEC } from './openapi-spec';

export const openapiRoutes = new Hono<AppEnv>();

openapiRoutes.get('/openapi.json', (c) => c.json(OPENAPI_SPEC));

openapiRoutes.get('/docs', (c) => {
	return c.html(`<!DOCTYPE html>
<html>
<head>
	<title>TenantIQ API Reference</title>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
	<script
		id="api-reference"
		data-url="/api/openapi.json"
		data-configuration='${JSON.stringify({ theme: 'kepler' })}'
	></script>
	<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});
