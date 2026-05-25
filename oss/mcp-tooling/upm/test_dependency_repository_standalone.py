"""Standalone test for DependencyRepository logic."""

import asyncio
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4


async def test_dependency_repository():
    """Test the DependencyRepository methods without full app context."""
    print("Testing Dependency Repository...")

    # Import the repository
    from udp.infrastructure.repositories.dependencies import DependencyRepository

    # Create repository and mock session
    repo = DependencyRepository()
    mock_session = AsyncMock()

    # Test 1: Count method
    print("\n1. Testing count method...")
    mock_result = AsyncMock()
    mock_result.scalar.return_value = 5
    mock_session.execute.return_value = mock_result

    count = await repo.count(mock_session)
    assert count == 5
    print("✓ Count method works correctly")

    # Test 2: List method
    print("\n2. Testing list method...")
    mock_result = AsyncMock()
    mock_package = MagicMock()
    mock_package.name = "test-package"
    mock_result.scalars.return_value.all.return_value = [mock_package]
    mock_session.execute.return_value = mock_result

    packages = await repo.list(mock_session, skip=0, limit=10)
    assert len(packages) == 1
    assert packages[0].name == "test-package"
    print("✓ List method works correctly")

    # Test 3: Get method
    print("\n3. Testing get method...")
    package_id = uuid4()
    mock_result = AsyncMock()
    mock_package = MagicMock()
    mock_package.id = package_id
    mock_result.scalars.return_value.first.return_value = mock_package
    mock_session.execute.return_value = mock_result

    package = await repo.get(mock_session, package_id)
    assert package is not None
    assert package.id == package_id
    print("✓ Get method works correctly")

    # Test 4: Search method
    print("\n4. Testing search method...")
    mock_result = AsyncMock()
    mock_package = MagicMock()
    mock_package.name = "search-result"
    mock_result.scalars.return_value.all.return_value = [mock_package]
    mock_session.execute.return_value = mock_result

    packages = await repo.search(mock_session, "search-term")
    assert len(packages) == 1
    assert packages[0].name == "search-result"
    print("✓ Search method works correctly")

    # Test 5: Create method
    print("\n5. Testing create method...")
    data = {
        "name": "new-package",
        "version": "1.0.0",
        "ecosystem": "npm",
    }

    await repo.create(mock_session, data)
    mock_session.add.assert_called()
    mock_session.commit.assert_called()
    mock_session.refresh.assert_called()
    print("✓ Create method works correctly")

    # Test 6: Update method
    print("\n6. Testing update method...")
    mock_package = MagicMock()
    mock_package.name = "old-name"

    data = {"name": "new-name", "version": "2.0.0"}

    result = await repo.update(mock_session, mock_package, data)
    assert mock_package.name == "new-name"
    assert mock_package.version == "2.0.0"
    mock_session.commit.assert_called()
    mock_session.refresh.assert_called()
    print("✓ Update method works correctly")

    # Test 7: Soft delete method
    print("\n7. Testing soft delete method...")
    mock_package = MagicMock()
    mock_package.is_deleted = False

    await repo.soft_delete(mock_session, mock_package)
    assert mock_package.is_deleted is True
    mock_session.commit.assert_called()
    print("✓ Soft delete method works correctly")

    print("\n✅ All tests passed! Dependency Repository is working correctly.")


if __name__ == "__main__":
    # Run the test
    asyncio.run(test_dependency_repository())
