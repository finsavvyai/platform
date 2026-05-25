"""
Unit tests for ecosystem adapters.

Test-driven development validation for package ecosystem adapters
with comprehensive coverage of parsing, resolution, and metadata extraction.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch

from udp.domain.models import EcosystemType, LicenseType
from udp.tools.ecosystems import (
    EcosystemFactory,
    NpmEcosystem,
    PyPIEcosystem,
    ParseError,
    RegistryError,
    get_ecosystem_for_file,
    get_supported_ecosystems,
)


class TestEcosystemFactory:
    """Test ecosystem factory functionality."""
    
    def test_create_npm_adapter(self):
        """Test creating npm ecosystem adapter."""
        adapter = EcosystemFactory.create_adapter(EcosystemType.NPM, "test-org")
        assert isinstance(adapter, NpmEcosystem)
        assert adapter.organization_id == "test-org"
    
    def test_create_pypi_adapter(self):
        """Test creating PyPI ecosystem adapter."""
        adapter = EcosystemFactory.create_adapter(EcosystemType.PYPI, "test-org")
        assert isinstance(adapter, PyPIEcosystem)
        assert adapter.organization_id == "test-org"
    
    def test_unsupported_ecosystem(self):
        """Test handling unsupported ecosystem."""
        with pytest.raises(ValueError, match="Unsupported ecosystem"):
            EcosystemFactory.create_adapter("unsupported", "test-org")
    
    def test_get_supported_ecosystems(self):
        """Test getting supported ecosystems."""
        ecosystems = EcosystemFactory.get_supported_ecosystems()
        assert EcosystemType.NPM in ecosystems
        assert EcosystemType.PYPI in ecosystems


class TestEcosystemFileDetection:
    """Test ecosystem detection from file names."""
    
    @pytest.mark.parametrize("filename,expected", [
        ("package.json", EcosystemType.NPM),
        ("requirements.txt", EcosystemType.PYPI),
        ("pyproject.toml", EcosystemType.PYPI),
        ("Pipfile", EcosystemType.PYPI),
        ("pom.xml", EcosystemType.MAVEN),
        ("Cargo.toml", EcosystemType.CARGO),
        ("unknown.txt", None),
        ("", None),
        (None, None),
    ])
    def test_get_ecosystem_for_file(self, filename, expected):
        """Test ecosystem detection from various file names."""
        result = get_ecosystem_for_file(filename)
        assert result == expected
    
    def test_case_insensitive_detection(self):
        """Test case insensitive file detection."""
        assert get_ecosystem_for_file("PACKAGE.JSON") == EcosystemType.NPM
        assert get_ecosystem_for_file("Requirements.TXT") == EcosystemType.PYPI


class TestNpmEcosystem:
    """Test npm ecosystem adapter."""
    
    @pytest.fixture
    def npm_adapter(self):
        """Create npm adapter instance."""
        return NpmEcosystem("test-org")
    
    @pytest.mark.asyncio
    async def test_parse_basic_package_json(self, npm_adapter):
        """Test parsing basic package.json."""
        package_json = json.dumps({
            "name": "test-package",
            "version": "1.0.0",
            "description": "Test package",
            "dependencies": {
                "lodash": "^4.17.21",
                "express": "~4.18.0"
            },
            "devDependencies": {
                "jest": "^29.0.0"
            },
            "license": "MIT",
            "author": "Test Author"
        })
        
        manifest = await npm_adapter.parse_manifest(package_json, "package.json")
        
        assert manifest.project_name == "test-package"
        assert manifest.project_version == "1.0.0"
        assert manifest.ecosystem == EcosystemType.NPM
        assert manifest.dependencies == {"lodash": "^4.17.21", "express": "~4.18.0"}
        assert manifest.dev_dependencies == {"jest": "^29.0.0"}
        assert manifest.metadata["description"] == "Test package"
        assert manifest.metadata["license"] == "MIT"
        assert manifest.metadata["author"] == "Test Author"
    
    @pytest.mark.asyncio
    async def test_parse_scoped_package(self, npm_adapter):
        """Test parsing scoped package.json."""
        package_json = json.dumps({
            "name": "@scope/test-package",
            "version": "1.0.0",
            "dependencies": {
                "@scope/another-package": "^1.0.0"
            }
        })
        
        manifest = await npm_adapter.parse_manifest(package_json, "package.json")
        assert manifest.project_name == "@scope/test-package"
        assert manifest.dependencies == {"@scope/another-package": "^1.0.0"}
    
    @pytest.mark.asyncio
    async def test_parse_invalid_json(self, npm_adapter):
        """Test handling invalid JSON."""
        invalid_json = "{ invalid json }"
        
        with pytest.raises(ParseError, match="Invalid JSON"):
            await npm_adapter.parse_manifest(invalid_json, "package.json")
    
    def test_extract_namespace(self, npm_adapter):
        """Test namespace extraction from package names."""
        assert npm_adapter._extract_namespace("@scope/package") == "scope"
        assert npm_adapter._extract_namespace("regular-package") is None
        assert npm_adapter._extract_namespace("@multi/scope/package") == "multi"
    
    def test_normalize_license(self, npm_adapter):
        """Test license normalization."""
        assert npm_adapter._normalize_license("MIT") == LicenseType.MIT
        assert npm_adapter._normalize_license({"type": "Apache-2.0"}) == LicenseType.APACHE_2_0
        assert npm_adapter._normalize_license("Unknown License") == LicenseType.UNKNOWN
        assert npm_adapter._normalize_license(None) == LicenseType.UNKNOWN
    
    def test_extract_author(self, npm_adapter):
        """Test author extraction."""
        assert npm_adapter._extract_author("John Doe") == "John Doe"
        assert npm_adapter._extract_author({"name": "Jane Smith"}) == "Jane Smith"
        assert npm_adapter._extract_author({"email": "test@example.com"}) is None
        assert npm_adapter._extract_author(None) is None


class TestPyPIEcosystem:
    """Test PyPI ecosystem adapter."""
    
    @pytest.fixture
    def pypi_adapter(self):
        """Create PyPI adapter instance."""
        return PyPIEcosystem("test-org")
    
    @pytest.mark.asyncio
    async def test_parse_requirements_txt(self, pypi_adapter):
        """Test parsing requirements.txt."""
        requirements_content = '''
# This is a comment
requests>=2.28.0
flask==2.2.0
django~=4.1.0
pytest  # Development dependency
        '''.strip()
        
        manifest = await pypi_adapter.parse_manifest(requirements_content, "requirements.txt")
        
        assert manifest.ecosystem == EcosystemType.PYPI
        assert manifest.project_name is None
        assert manifest.project_version is None
        assert "requests" in manifest.dependencies
        assert "flask" in manifest.dependencies
        assert "django" in manifest.dependencies
        assert "pytest" in manifest.dependencies
        assert manifest.dependencies["requests"] == ">=2.28.0"
        assert manifest.dependencies["flask"] == "==2.2.0"
    
    @pytest.mark.asyncio
    async def test_parse_pyproject_toml(self, pypi_adapter):
        """Test parsing pyproject.toml."""
        pyproject_content = '''
[project]
name = "test-package"
version = "1.0.0"
description = "A test package"
dependencies = [
    "requests>=2.28.0",
    "click>=8.0.0"
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "black>=22.0.0"
]
        '''
        
        manifest = await pypi_adapter.parse_manifest(pyproject_content, "pyproject.toml")
        
        assert manifest.project_name == "test-package"
        assert manifest.project_version == "1.0.0"
        assert manifest.ecosystem == EcosystemType.PYPI
        assert "requests" in manifest.dependencies
        assert "click" in manifest.dependencies
        assert "pytest" in manifest.dev_dependencies
        assert "black" in manifest.dev_dependencies
        assert manifest.metadata["description"] == "A test package"
    
    def test_normalize_license(self, pypi_adapter):
        """Test license normalization for PyPI."""
        assert pypi_adapter._normalize_license("MIT") == LicenseType.MIT
        assert pypi_adapter._normalize_license("MIT License") == LicenseType.MIT
        assert pypi_adapter._normalize_license("Apache 2.0") == LicenseType.APACHE_2_0
        assert pypi_adapter._normalize_license("BSD") == LicenseType.BSD_3_CLAUSE
        assert pypi_adapter._normalize_license("Custom License") == LicenseType.UNKNOWN
        assert pypi_adapter._normalize_license(None) == LicenseType.UNKNOWN


@pytest.mark.asyncio
async def test_ecosystem_adapter_lifecycle():
    """Test adapter lifecycle management."""
    adapter = EcosystemFactory.create_adapter(EcosystemType.NPM, "test-org")
    
    # Adapter should have HTTP client
    assert adapter.http_client is not None
    
    # Should be able to close cleanly
    await adapter.close()


def test_supported_ecosystems_function():
    """Test standalone supported ecosystems function."""
    ecosystems = get_supported_ecosystems()
    assert isinstance(ecosystems, list)
    assert len(ecosystems) > 0
    assert all(isinstance(e, EcosystemType) for e in ecosystems)