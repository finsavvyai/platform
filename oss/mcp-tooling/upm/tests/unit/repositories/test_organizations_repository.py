import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from udp.core.database import Base
from udp.infrastructure.repositories.organizations import OrganizationRepository


@pytest.fixture
async def db_session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", echo=False, poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_repository_crud(db_session: AsyncSession):
    repo = OrganizationRepository()

    # create
    org = await repo.create(db_session, {"name": "Acme", "slug": "acme"})
    assert org.id is not None

    # get
    got = await repo.get(db_session, org.id)
    assert got is not None and got.slug == "acme"

    # get by slug
    got2 = await repo.get_by_slug(db_session, "acme")
    assert got2 is not None and str(got2.id) == str(org.id)

    # list/count
    total = await repo.count(db_session)
    assert total >= 1
    items = await repo.list(db_session, skip=0, limit=10)
    assert len(items) >= 1

    # update settings
    updated = await repo.update_settings(db_session, org, {"a": 1})
    assert updated.settings.get("a") == 1

    # update fields
    updated2 = await repo.update(db_session, org, {"name": "Acme Inc", "slug": "acme-inc"})
    assert updated2.name == "Acme Inc"
    assert updated2.slug == "acme-inc"

    # soft delete
    deleted = await repo.soft_delete(db_session, org)
    assert deleted.is_deleted is True
