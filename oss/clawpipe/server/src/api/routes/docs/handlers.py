"""Request handlers for API documentation endpoints."""

import json

from aiohttp import web

from src.api.routes.docs.spec import OPENAPI_SPEC

_REDOC_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>FinSavvyAI API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet"/>
  <style>body { margin: 0; padding: 0; }</style>
</head>
<body>
  <redoc spec-url="/openapi.json"
         hide-download-button
         theme='{"colors":{"primary":{"main":"#412991"}}}'></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
</body>
</html>"""


async def handle_openapi_spec(_request: web.Request) -> web.Response:
    return web.Response(
        text=json.dumps(OPENAPI_SPEC, indent=2),
        content_type="application/json",
    )


async def handle_docs(_request: web.Request) -> web.Response:
    return web.Response(text=_REDOC_HTML, content_type="text/html")
