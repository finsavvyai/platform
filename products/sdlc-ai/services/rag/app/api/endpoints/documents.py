"""
Document Processing Endpoints

Endpoints for document upload, processing, and management in the RAG service.
"""

from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()


@router.post("/upload")
async def upload_document() -> Dict[str, Any]:
    """Upload and process a document"""
    return {"message": "Document upload endpoint - to be implemented"}


@router.get("/")
async def list_documents() -> Dict[str, Any]:
    """List processed documents"""
    return {"message": "Document listing endpoint - to be implemented"}
