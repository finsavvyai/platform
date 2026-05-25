"""
Website routes for UPM landing pages and marketing pages.
"""

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["website"])

# Templates directory - calculate from routes/website.py
# Path: src/udp/api/routes/website.py -> src/udp/api/routes -> src/udp/api -> src/udp -> src -> project_root
templates_dir = Path(__file__).parent.parent.parent.parent / "templates" / "website"

# Fallback if path doesn't exist
import os

if not templates_dir.exists():
    cwd = Path(os.getcwd())
    templates_dir = cwd / "templates" / "website"

templates = Jinja2Templates(directory=str(templates_dir))


@router.get("/pricing")
async def pricing_page(request: Request):
    """Pricing page."""
    return templates.TemplateResponse("pricing.html", {"request": request})


@router.get("/docs")
async def docs_page(request: Request):
    """Documentation page."""
    return templates.TemplateResponse("docs.html", {"request": request})


@router.get("/about")
async def about_page(request: Request):
    """About page."""
    return templates.TemplateResponse("about.html", {"request": request})


@router.get("/blog")
async def blog_page(request: Request):
    """Blog page."""
    return templates.TemplateResponse("blog.html", {"request": request})
