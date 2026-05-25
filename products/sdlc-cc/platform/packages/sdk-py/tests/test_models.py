"""
Test Pydantic models.
"""

import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError

from sdlc_sdk.models.user import User, UserCreate, UserUpdate
from sdlc_sdk.models.auth import TokenInfo, LoginRequest
from sdlc_sdk.models.tenant import Tenant, TenantCreate
from sdlc_sdk.models.document import Document, DocumentMetadata
from sdlc_sdk.models.rag import RAGQuery, RAGResponse, RAGSource


class TestUserModels:
    """Test user-related models."""

    def test_user_create_validation(self):
        """Test user creation validation."""
        # Valid user creation
        user_data = {
            "email": "test@example.com",
            "name": "Test User",
            "tenant_id": "tenant-123",
            "password": "SecurePass123!"
        }
        user = UserCreate(**user_data)
        assert user.email == "test@example.com"
        assert user.name == "Test User"

        # Invalid email
        with pytest.raises(ValidationError):
            UserCreate(
                email="invalid-email",
                name="Test User",
                tenant_id="tenant-123"
            )

        # Short password
        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                name="Test User",
                tenant_id="tenant-123",
                password="short"
            )

    def test_user_update_optional_fields(self):
        """Test user update with optional fields."""
        update_data = UserUpdate(name="Updated Name")
        assert update_data.name == "Updated Name"
        assert update_data.email is None

        # Test with all fields
        full_update = UserUpdate(
            name="Full Update",
            phone="+1234567890",
            timezone="America/New_York",
            is_active=False
        )
        assert full_update.name == "Full Update"
        assert full_update.phone == "+1234567890"
        assert full_update.timezone == "America/New_York"
        assert full_update.is_active is False

    def test_user_model_properties(self):
        """Test user model properties."""
        user_data = {
            "id": "user-123",
            "email": "test@example.com",
            "name": "Test User",
            "tenant_id": "tenant-123",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        user = User(**user_data)

        # Test display_name property
        user.first_name = "John"
        user.last_name = "Doe"
        assert user.display_name == "John Doe"

        # Test with only name
        user.first_name = None
        user.last_name = None
        assert user.display_name == "Test User"

        # Test email normalization
        user.email = "TEST@EXAMPLE.COM"
        assert user.email == "test@example.com"


class TestAuthModels:
    """Test authentication models."""

    def test_token_info(self):
        """Test token info model."""
        token_data = {
            "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "refresh-token-123"
        }
        token = TokenInfo(**token_data)

        assert token.access_token == token_data["access_token"]
        assert token.token_type == "Bearer"
        assert token.expires_in == 3600

        # Test expires_at property
        expires_at = token.expires_at
        assert isinstance(expires_at, datetime)
        assert expires_at > datetime.utcnow()
        assert expires_at < datetime.utcnow() + timedelta(seconds=3700)

    def test_login_request(self):
        """Test login request model."""
        login_data = {
            "email": "test@example.com",
            "password": "SecurePass123!",
            "tenant_id": "tenant-123",
            "remember_me": True,
            "mfa_code": "123456"
        }
        login = LoginRequest(**login_data)

        assert login.email == "test@example.com"
        assert login.password == "SecurePass123!"
        assert login.tenant_id == "tenant-123"
        assert login.remember_me
        assert login.mfa_code == "123456"

        # Test invalid email
        with pytest.raises(ValidationError):
            LoginRequest(
                email="invalid-email",
                password="password"
            )

        # Test short password
        with pytest.raises(ValidationError):
            LoginRequest(
                email="test@example.com",
                password="short"
            )


class TestTenantModels:
    """Test tenant models."""

    def test_tenant_create_validation(self):
        """Test tenant creation validation."""
        tenant_data = {
            "name": "Test Tenant",
            "owner_id": "user-123",
            "owner_email": "owner@example.com",
            "plan": "pro"
        }
        tenant = TenantCreate(**tenant_data)

        assert tenant.name == "Test Tenant"
        assert tenant.owner_id == "user-123"
        assert tenant.plan == "pro"

        # Test slug generation
        assert tenant.slug == "test-tenant"

        # Test custom slug
        tenant_with_slug = TenantCreate(
            name="Test Tenant",
            slug="custom-slug",
            owner_id="user-123",
            owner_email=" "owner@example.com"
        )
        assert tenant_with_slug.slug == "custom-slug"

        # Test invalid slug
        with pytest.raises(ValidationError):
            TenantCreate(
                name="Test",
                slug="invalid slug!",
                owner_id="user-123",
                owner_email="owner@example.com"
            )

    def test_tenant_model_properties(self):
        """Test tenant model properties."""
        tenant_data = {
            "id": "tenant-123",
            "name": "Test Tenant",
            "slug": "test-tenant",
            "owner_id": "user-123",
            "status": "active",
            "hierarchy_level": 0,
            "settings": {
                "name": "Test Tenant",
                "features": {"document_upload": True}
            },
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        tenant = Tenant(**tenant_data)

        assert tenant.is_active
        assert tenant.is_root

        # Test non-root tenant
        tenant.hierarchy_level = 1
        assert not tenant.is_root


class TestDocumentModels:
    """Test document models."""

    def test_document_metadata(self):
        """Test document metadata model."""
        metadata = DocumentMetadata(
            title="Test Document",
            author="Test Author",
            file_type="pdf",
            mime_type="application/pdf",
            size_bytes=1024000,
            category="technical",
            sensitivity="internal"
        )

        assert metadata.title == "Test Document"
        assert metadata.author == "Test Author"
        assert metadata.file_type == "pdf"
        assert metadata.mime_type == "application/pdf"
        assert metadata.size_bytes == 1024000
        assert metadata.sensitivity == "internal"

    def test_document_model_properties(self):
        """Test document model properties."""
        doc_data = {
            "id": "doc-123",
            "name": "test.pdf",
            "tenant_id": "tenant-123",
            "file_path": "/documents/test.pdf",
            "metadata": DocumentMetadata(
                title="Test Document",
                file_type="pdf",
                mime_type="application/pdf",
                size_bytes=1024
            ),
            "processing_status": "completed",
            "is_indexed": True,
            "owner_id": "user-123",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        doc = Document(**doc_data)

        assert doc.is_processed
        assert doc.is_searchable

        # Test not processed
        doc.processing_status = "pending"
        assert not doc.is_processed

        # Test not indexed
        doc.is_indexed = False
        assert not doc.is_searchable


class TestRAGModels:
    """Test RAG models."""

    def test_rag_query_validation(self):
        """Test RAG query validation."""
        query_data = {
            "query": "What is the meaning of life?",
            "tenant_id": "tenant-123",
            "document_ids": ["doc-1", "doc-2"],
            "top_k": 5
        }
        query = RAGQuery(**query_data)

        assert query.query == "What is the meaning of life?"
        assert query.tenant_id == "tenant-123"
        assert query.document_ids == ["doc-1", "doc-2"]
        assert query.top_k == 5

        # Test empty query
        with pytest.raises(ValidationError):
            RAGQuery(
                query="",
                tenant_id="tenant-123"
            )

        # Test whitespace query
        with pytest.raises(ValidationError):
            RAGQuery(
                query="   ",
                tenant_id="tenant-123"
            )

    def test_rag_config_validation(self):
        """Test RAG configuration validation."""
        config_data = {
            "retrieval_top_k": 5,
            "semantic_weight": 0.7,
            "keyword_weight": 0.3,
            "max_context_length": 4000,
            "model": "gpt-4"
        }
        config = RAGConfig(**config_data)

        assert config.retrieval_top_k == 5
        assert config.semantic_weight == 0.7
        assert config.keyword_weight == 0.3

        # Test invalid weights
        with pytest.raises(ValidationError):
            RAGConfig(
                semantic_weight=0.8,
                keyword_weight=0.4  # Sum > 1.0
            )

    def test_rag_response_properties(self):
        """Test RAG response properties."""
        sources = [
            RAGSource(
                document_id="doc-1",
                document_name="Document 1",
                content="Relevant content 1",
                score=0.95,
                rank=1
            ),
            RAGSource(
                document_id="doc-2",
                document_name="Document 2",
                content="Relevant content 2",
                score=0.85,
                rank=2
            )
        ]

        response_data = {
            "query_id": "query-123",
            "answer": "The meaning of life is 42.",
            "sources": sources,
            "confidence": 0.9,
            "model": "gpt-4",
            "tokens_used": 150,
            "generation_time_ms": 500,
            "retrieval_time_ms": 100,
            "documents_retrieved": 10,
            "created_at": datetime.utcnow()
        }
        response = RAGResponse(**response_data)

        assert response.answer == "The meaning of life is 42."
        assert response.source_count == 2
        assert response.has_citations
        assert response.first_choice is None  # No choices in RAGResponse
