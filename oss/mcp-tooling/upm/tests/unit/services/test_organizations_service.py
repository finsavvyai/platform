import pytest
from uuid import uuid4
from types import SimpleNamespace
from unittest.mock import AsyncMock

from udp.services.organizations import OrganizationService


class DummyOrg(SimpleNamespace):
    pass


def make_org(**overrides):
    base = dict(
        id=uuid4(),
        name="Acme",
        slug="acme",
        domain=None,
        industry=None,
        size=None,
        country=None,
        compliance_frameworks=[],
        allowed_licenses=[],
        blocked_licenses=[],
        max_vulnerability_score=7.0,
        auto_update_enabled=False,
        require_approval=True,
        notification_emails=[],
        settings={},
        created_at=None,
        updated_at=None,
        is_deleted=False,
    )
    base.update(overrides)
    return DummyOrg(**base)


@pytest.mark.asyncio
async def test_create_success():
    repo = AsyncMock()
    repo.get_by_slug.return_value = None
    created = make_org()
    repo.create.return_value = created
    service = OrganizationService(repo, db=AsyncMock())

    data = {"name": "Acme", "slug": "acme"}
    res = await service.create(data)
    assert res["name"] == "Acme"
    assert res["slug"] == "acme"
    repo.create.assert_awaited()


@pytest.mark.asyncio
async def test_create_duplicate_slug_conflict():
    repo = AsyncMock()
    repo.get_by_slug.return_value = make_org()
    service = OrganizationService(repo, db=AsyncMock())

    with pytest.raises(Exception) as ei:
        await service.create({"name": "Acme", "slug": "acme"})
    assert "already exists" in str(ei.value)


@pytest.mark.asyncio
async def test_create_missing_fields():
    repo = AsyncMock()
    service = OrganizationService(repo, db=AsyncMock())
    with pytest.raises(Exception):
        await service.create({"name": "OnlyName"})


@pytest.mark.asyncio
async def test_get_not_found():
    repo = AsyncMock()
    repo.get.return_value = None
    service = OrganizationService(repo, db=AsyncMock())
    with pytest.raises(Exception):
        await service.get(uuid4())


@pytest.mark.asyncio
async def test_update_settings_merge():
    repo = AsyncMock()
    org = make_org(settings={"a": 1})
    repo.get.return_value = org
    repo.update_settings.return_value = make_org(settings={"a": 3, "b": 2})
    service = OrganizationService(repo, db=AsyncMock())

    res = await service.update_settings(org.id, {"b": 2, "a": 3})
    assert res["status"] == "updated"
    assert res["organization"]["settings"]["a"] == 3
    assert res["organization"]["settings"]["b"] == 2


@pytest.mark.asyncio
async def test_update_fields_and_slug_duplicate():
    repo = AsyncMock()
    org = make_org()
    repo.get.return_value = org
    # get_by_slug returns existing when trying to set to duplicate
    repo.get_by_slug.return_value = make_org(slug="taken")
    service = OrganizationService(repo, db=AsyncMock())

    with pytest.raises(Exception):
        await service.update(org.id, {"slug": "taken"})

    # Now allow unique
    repo.get_by_slug.return_value = None
    repo.update.return_value = make_org(name="Acme Inc", slug="acme-inc")
    res = await service.update(org.id, {"name": "Acme Inc", "slug": "acme-inc"})
    assert res["name"] == "Acme Inc"
    assert res["slug"] == "acme-inc"


@pytest.mark.asyncio
async def test_delete_soft():
    repo = AsyncMock()
    org = make_org()
    repo.get.return_value = org
    repo.soft_delete.return_value = make_org(is_deleted=True)
    service = OrganizationService(repo, db=AsyncMock())

    res = await service.delete(org.id)
    assert res["status"] == "deleted"
