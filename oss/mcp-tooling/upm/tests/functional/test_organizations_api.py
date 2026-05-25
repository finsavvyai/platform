import os
import pytest
from httpx import AsyncClient

from sqlalchemy.ext.asyncio import AsyncSession

from udp.core.database import get_async_session


@pytest.fixture
async def client_with_db(async_db_session: AsyncSession):
    async def _override_get_async_session():
        yield async_db_session

    # Ensure required env for settings before importing app
    os.environ.setdefault("SECURITY__SECRET_KEY", "x" * 40)

    # Import app lazily after env is set
    from udp.api.main import app

    app.dependency_overrides[get_async_session] = _override_get_async_session
    # Build a valid JWT using the configured secret
    import jwt
    payload = {
        "sub": "12345678-1234-1234-1234-123456789012",
        "email": "admin@example.com",
        "name": "Admin User",
        "role": "admin",
        "permissions": ["org:read", "org:write", "org:admin"],
        "org": "87654321-4321-4321-4321-210987654321",
        # short-lived token for tests
        "exp": __import__("time").time() + 3600,
    }
    token = jwt.encode(payload, os.environ["SECURITY__SECRET_KEY"], algorithm="HS256")

    async with AsyncClient(app=app, base_url="http://test") as client:
        client.headers.update({"Authorization": f"Bearer {token}"})
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_and_get_organization(client_with_db: AsyncClient):
    # Create
    payload = {
        "name": "Acme Corp",
        "slug": "acme",
        "domain": "acme.com",
        "industry": "Technology",
        "size": "Enterprise",
        "country": "US",
        "settings": {"feature_x": True}
    }
    resp = await client_with_db.post("/api/v1/organizations/", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == payload["name"]
    assert data["slug"] == payload["slug"]
    org_id = data["id"]

    # Get by id
    resp2 = await client_with_db.get(f"/api/v1/organizations/{org_id}")
    assert resp2.status_code == 200
    got = resp2.json()
    assert got["id"] == org_id
    assert got["domain"] == "acme.com"


@pytest.mark.asyncio
async def test_list_organizations_with_pagination(client_with_db: AsyncClient):
    # Seed multiple orgs
    for i in range(3):
        await client_with_db.post(
            "/api/v1/organizations/",
            json={"name": f"Org {i}", "slug": f"org-{i}"}
        )

    resp = await client_with_db.get("/api/v1/organizations/?skip=0&limit=2")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and data["total"] >= 3
    assert len(data["organizations"]) == 2


@pytest.mark.asyncio
async def test_update_organization_settings(client_with_db: AsyncClient):
    # Create org
    resp = await client_with_db.post(
        "/api/v1/organizations/",
        json={"name": "Settings Org", "slug": "settings-org", "settings": {"a": 1}}
    )
    assert resp.status_code == 201
    org_id = resp.json()["id"]

    # Update settings
    resp2 = await client_with_db.put(
        f"/api/v1/organizations/{org_id}/settings",
        json={"b": 2, "a": 3}
    )
    assert resp2.status_code == 200
    body = resp2.json()
    assert body["status"] == "updated"
    org = body["organization"]
    assert org["settings"]["a"] == 3
    assert org["settings"]["b"] == 2


@pytest.mark.asyncio
async def test_create_duplicate_slug_conflict(client_with_db: AsyncClient):
    p = {"name": "Dup", "slug": "dup"}
    r1 = await client_with_db.post("/api/v1/organizations/", json=p)
    assert r1.status_code == 201
    r2 = await client_with_db.post("/api/v1/organizations/", json=p)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_create_invalid_missing_fields(client_with_db: AsyncClient):
    r = await client_with_db.post("/api/v1/organizations/", json={"name": "No Slug"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_update_organization_fields_and_slug_conflict(client_with_db: AsyncClient):
    # Create two orgs
    r1 = await client_with_db.post("/api/v1/organizations/", json={"name": "A", "slug": "a"})
    r2 = await client_with_db.post("/api/v1/organizations/", json={"name": "B", "slug": "b"})
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]

    # Update first org name and slug
    u1 = await client_with_db.put(f"/api/v1/organizations/{id1}", json={"name": "A Inc", "slug": "a-inc"})
    assert u1.status_code == 200
    body = u1.json()
    assert body["name"] == "A Inc"
    assert body["slug"] == "a-inc"

    # Try to update second org slug to existing one
    u2 = await client_with_db.put(f"/api/v1/organizations/{id2}", json={"slug": "a-inc"})
    assert u2.status_code == 409


@pytest.mark.asyncio
async def test_delete_organization_soft_and_visibility(client_with_db: AsyncClient):
    # Create org
    r = await client_with_db.post("/api/v1/organizations/", json={"name": "Del", "slug": "del"})
    assert r.status_code == 201
    oid = r.json()["id"]

    # Delete
    d = await client_with_db.delete(f"/api/v1/organizations/{oid}")
    assert d.status_code == 200
    assert d.json()["status"] == "deleted"

    # Get should 404
    g = await client_with_db.get(f"/api/v1/organizations/{oid}")
    assert g.status_code == 404

    # Should not appear in list
    lst = await client_with_db.get("/api/v1/organizations?skip=0&limit=100")
    assert lst.status_code == 200
    assert all(item["id"] != oid for item in lst.json()["organizations"])
