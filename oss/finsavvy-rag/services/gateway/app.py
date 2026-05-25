import os
from typing import Any, Dict
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
import httpx

app = FastAPI(title="FinSavvyAI Gateway")

LLM_LOCAL = os.getenv("LLM_LOCAL_URL", "http://127.0.0.1:8000")
LLM_LB    = os.getenv("LLM_LB_URL",    os.getenv("CADDY_URL", "http://127.0.0.1:8100"))
UPSTREAM  = os.getenv("GATEWAY_UPSTREAM", "local")  # 'local' or 'lb'

def current_upstream() -> str:
    return LLM_LB if UPSTREAM == "lb" else LLM_LOCAL

@app.get("/healthz")
async def health() -> Dict[str, Any]:
    url = f"{current_upstream()}/v1/models"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(url)
            ok = r.status_code == 200
            return {"ok": ok, "upstream": current_upstream(), "status": r.status_code}
    except Exception as e:
        return {"ok": False, "upstream": current_upstream(), "error": str(e)}

async def proxy(request: Request, tail: str) -> Response:
    upstream = current_upstream()
    url = f"{upstream}/v1/{tail}"
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    method = request.method

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            resp = await client.request(method, url, headers=headers, content=body)
        return Response(content=resp.content, status_code=resp.status_code, headers=dict(resp.headers))
    except httpx.HTTPError as e:
        return JSONResponse({"error": str(e), "upstream": upstream}, status_code=502)

@app.api_route("/v1/{tail:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def v1_proxy(tail: str, request: Request):
    return await proxy(request, tail)
