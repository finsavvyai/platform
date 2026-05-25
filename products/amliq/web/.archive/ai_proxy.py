"""
AML AI Summarization — Backend Reference Implementation

Integrate this endpoint into the main backend as:
  POST /api/v1/ai/summarize

Requires:
  - ANTHROPIC_API_KEY in backend env
  - pip install any-llm fastapi

The frontend calls this via the existing authenticated API client
(Bearer token forwarded automatically). Do NOT deploy as a standalone
sidecar in production.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="AMLIQ AI Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

PROMPTS = {
    "alert": (
        "You are an AML compliance officer assistant. Summarize this alert in 2-3 sentences. "
        "Focus on: entity name, risk type, why it triggered, recommended action. "
        "Be concise and factual.\n\nAlert data:\n{text}"
    ),
    "adverse_media": (
        "Summarize this adverse media article for a compliance analyst in 2 sentences. "
        "Include: subject entity, nature of allegation, source credibility signals.\n\n{text}"
    ),
    "case": (
        "Summarize this compliance case for a senior reviewer in 3 bullet points. "
        "Cover: key risk indicators, evidence gathered, recommended disposition.\n\n{text}"
    ),
}


class SummarizeRequest(BaseModel):
    text: str
    type: str = "alert"


class SummarizeResponse(BaseModel):
    summary: str
    model: str


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize(req: SummarizeRequest):
    if req.type not in PROMPTS:
        raise HTTPException(status_code=400, detail=f"type must be one of {list(PROMPTS)}")
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")

    try:
        from any_llm import LLM  # type: ignore

        llm = LLM(provider="anthropic", model="claude-haiku-4-5-20251001")
        prompt = PROMPTS[req.type].format(text=req.text[:4000])
        result = await llm.complete(prompt)
        return SummarizeResponse(summary=result, model="claude-haiku-4-5-20251001")
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="any-llm not installed. Run: pip install any-llm",
        )
    except Exception as e:
        import logging
        logging.exception("AI summarization failed")
        raise HTTPException(status_code=500, detail="Internal error")


@app.get("/health")
def health():
    return {"status": "ok"}
