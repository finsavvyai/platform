"""FastAPI entrypoint for insights-detector."""

from __future__ import annotations

from fastapi import FastAPI

from app import __version__

app = FastAPI(title="insights-detector", version=__version__)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    return {"status": "ready"}
