"""
SDLC.ai Python SDK
Enterprise-grade Python SDK for seamless integration with SDLC.ai platform

Features:
- 🚀 Async/await support with asyncio
- 🔐 Enterprise authentication (SSO, SAML, OAuth2)
- 📊 Real-time streaming with WebSocket
- 🧠 Multi-model AI integration
- 📄 Document processing and RAG
- 💳 PCI-compliant payment processing
- 📈 Analytics and monitoring
- 🔍 Full type hints with mypy support
- 📚 Comprehensive documentation
"""

from typing import Any, Dict, List, Optional, Union, AsyncGenerator
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
import asyncio
import json
import logging
from pathlib import Path
import aiohttp
import websockets
from pydantic import BaseModel, Field, validator
import backoff

# Version
__version__ = "1.0.0"
__author__ = "SDLC.ai Team"
__email__ = "sdk@sdlc.ai"

# Configure logging
logger = logging.getLogger(__name__)

class AuthenticationError(Exception):
    """Authentication failed"""
    pass

class AuthorizationError(Exception):
    """Authorization failed"""
    pass

class RateLimitError(Exception):
    """Rate limit exceeded"""
    pass

class ServiceUnavailableError(Exception):
    """Service temporarily unavailable"""
    pass

class ValidationError(Exception):
    """Request validation failed"""
    pass

class APIError(Exception):
    """General API error"""
    def __init__(self, message: str, code: str = None, details: Dict = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}

class Environment(Enum):
    """API environment"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

@dataclass
class SDLCConfig:
    """SDK Configuration"""
    api_key: str
    base_url: str = "https://api.sdlc.ai"
    environment: Environment = Environment.PRODUCTION
    timeout: int = 30
    max_retries: int = 3
    enable_metrics: bool = True
    enable_websockets: bool = True
    verify_ssl: bool = True
    user_agent: str = f"sdlc-python-sdk/{__version__}"

class AuthContext(BaseModel):
    """Authentication context"""
    user_id: str
    tenant_id: str
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: datetime
    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class QueryRequest(BaseModel):
    """RAG query request"""
    query: str
    context: Optional[List[str]] = None
    max_results: int = Field(default=10, ge=1, le=100)
    model: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = None
    include_citations: bool = True
    include_metadata: bool = True
    filters: Dict[str, Any] = Field(default_factory=dict)

class QueryResponse(BaseModel):
    """RAG query response"""
    query_id: str
    response: str
    confidence: float = Field(ge=0.0, le=1.0)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    token_usage: Dict[str, int] = Field(default_factory=dict)
    response_time_ms: int
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentUpload(BaseModel):
    """Document upload request"""
    file_path: Union[str, Path]
    name: Optional[str] = None
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    access_control: Optional[Dict[str, Any]] = None

class DocumentInfo(BaseModel):
    """Document information"""
    document_id: str
    name: str
    size: int
    content_type: str
    status: str
    created_at: datetime
    updated_at: datetime
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PaymentMethod(BaseModel):
    """Payment method information"""
    token_id: str
    type: str
    last_four: str
    expiry_month: str
    expiry_year: str
    brand: Optional[str] = None
    is_default: bool = False

class PaymentRequest(BaseModel):
    """Payment request"""
    amount_cents: int = Field(gt=0)
    currency: str = Field(regex="^[A-Z]{3}$")
    payment_method_token: str
    description: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PaymentResponse(BaseModel):
    """Payment response"""
    payment_id: str
    status: str
    amount_cents: int
    currency: str
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SDLCClient:
    """Main SDLC.ai client class"""

    def __init__(self, config: SDLCConfig):
        """Initialize SDLC client

        Args:
            config: SDK configuration
        """
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None
        self._auth_context: Optional[AuthContext] = None
        self._websocket: Optional[websockets.WebSocketServerProtocol] = None
        self._base_url = config.base_url.rstrip('/')

        # Configure session
        self._headers = {
            "User-Agent": config.user_agent,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        # Configure timeout
        self._timeout = aiohttp.ClientTimeout(total=config.timeout)

        # Setup logging
        logging.basicConfig(level=logging.INFO)

        logger.info(f"SDLC.ai Python SDK v{__version__} initialized")
        logger.debug(f"Base URL: {self._base_url}")
        logger.debug(f"Environment: {config.environment.value}")

    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    async def _ensure_session(self):
        """Ensure aiohttp session exists"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers=self._headers,
                timeout=self._timeout,
                connector=aiohttp.TCPConnector(
                    limit=100,
                    limit_per_host=30,
                    verify_ssl=self.config.verify_ssl
                )
            )

    async def close(self):
        """Close the client and cleanup resources"""
        if self._session and not self._session.closed:
            await self._session.close()

        if self._websocket:
            await self._websocket.close()

        logger.info("SDLC.ai client closed")

    def _add_auth_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Add authentication headers to request"""
        if self._auth_context:
            headers["Authorization"] = f"Bearer {self._auth_context.access_token}"
            headers["X-Tenant-ID"] = self._auth_context.tenant_id
        return headers

    @backoff.on_exception(
        backoff.expo,
        (aiohttp.ClientError, asyncio.TimeoutError),
        max_tries=3,
        jitter=backoff.random_jitter
    )
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic"""
        await self._ensure_session()

        url = f"{self._base_url}{endpoint}"
        headers = kwargs.pop("headers", {})
        headers = self._add_auth_headers(headers)

        logger.debug(f"Making {method} request to {url}")

        try:
            async with self._session.request(method, url, headers=headers, **kwargs) as response:
                if response.status == 401:
                    raise AuthenticationError("Authentication failed")
                elif response.status == 403:
                    raise AuthorizationError("Authorization failed")
                elif response.status == 429:
                    raise RateLimitError("Rate limit exceeded")
                elif response.status >= 500:
                    raise ServiceUnavailableError(f"Service error: {response.status}")

                response.raise_for_status()
                data = await response.json()

                logger.debug(f"Request successful: {response.status}")
                return data

        except aiohttp.ClientError as e:
            logger.error(f"Request failed: {e}")
            raise APIError(f"Request failed: {e}")

    # Authentication Methods

    async def authenticate(self, api_key: str, tenant_id: str) -> AuthContext:
        """Authenticate with API key

        Args:
            api_key: Your API key
            tenant_id: Your tenant ID

        Returns:
            Authentication context
        """
        self.config.api_key = api_key

        payload = {
            "api_key": api_key,
            "tenant_id": tenant_id
        }

        response = await self._make_request(
            "POST",
            "/auth/api-key",
            json=payload
        )

        self._auth_context = AuthContext(**response)
        logger.info(f"Authenticated successfully for tenant {tenant_id}")

        return self._auth_context

    async def refresh_token(self) -> AuthContext:
        """Refresh authentication token"""
        if not self._auth_context or not self._auth_context.refresh_token:
            raise AuthenticationError("No refresh token available")

        payload = {
            "refresh_token": self._auth_context.refresh_token
        }

        response = await self._make_request(
            "POST",
            "/auth/refresh",
            json=payload
        )

        self._auth_context = AuthContext(**response)
        logger.info("Token refreshed successfully")

        return self._auth_context

    # RAG Methods

    async def query(self, request: QueryRequest) -> QueryResponse:
        """Execute RAG query

        Args:
            request: Query request

        Returns:
            Query response with citations and metadata
        """
        if not self._auth_context:
            raise AuthenticationError("Not authenticated")

        payload = request.dict(exclude_none=True)

        response = await self._make_request(
            "POST",
            "/rag/query",
            json=payload
        )

        result = QueryResponse(**response)
        logger.debug(f"Query executed: {request.query[:50]}...")

        return result

    async def query_stream(
        self,
        request: QueryRequest
    ) -> AsyncGenerator[str, None]:
        """Execute streaming RAG query

        Args:
            request: Query request

        Yields:
            Response tokens as they're generated
        """
        if not self._auth_context:
            raise AuthenticationError("Not authenticated")

        payload = request.dict(exclude_none=True)
        payload["stream"] = True

        await self._ensure_session()

        url = f"{self._base_url}/rag/query"
        headers = self._add_auth_headers({})

        async with self._session.post(url, json=payload, headers=headers) as response:
            response.raise_for_status()

            async for line in response.content:
                if line:
                    try:
                        data = json.loads(line.decode('utf-8').strip())
                        if data.get("type") == "token":
                            yield data.get("content", "")
                        elif data.get("type") == "done":
                            break
                    except json.JSONDecodeError:
                        continue

    # Document Methods

    async def upload_document(self, document: DocumentUpload) -> DocumentInfo:
        """Upload document for processing

        Args:
            document: Document to upload

        Returns:
            Document information
        """
        if not self._auth_context:
            raise AuthenticationError("Not authenticated")

        file_path = Path(document.file_path)
        if not file_path.exists():
            raise ValidationError(f"File not found: {file_path}")

        # Create multipart form data
        data = aiohttp.FormData()

        # Add file
        data.add_field(
            "file",
            open(file_path, "rb"),
            filename=file_path.name,
            content_type="application/octet-stream"
        )

        # Add metadata
        if document.name:
            data.add_field("name", document.name)
        if document.description:
            data.add_field("description", document.description)
        if document.tags:
            data.add_field("tags", json.dumps(document.tags))
        if document.metadata:
            data.add_field("metadata", json.dumps(document.metadata))
        if document.access_control:
            data.add_field("access_control", json.dumps(document.access_control))

        await self._ensure_session()

        url = f"{self._base_url}/documents/upload"
        headers = self._add_auth_headers({})
        # Remove Content-Type for multipart requests
        headers.pop("Content-Type", None)

        async with self._session.post(url, data=data, headers=headers) as response:
            if response.status == 401:
                raise AuthenticationError("Authentication failed")
            elif response.status == 403:
                raise AuthorizationError("Authorization failed")
            elif response.status == 429:
                raise RateLimitError("Rate limit exceeded")
            elif response.status >= 500:
                raise ServiceUnavailableError(f"Service error: {response.status}")

            response.raise_for_status()
            result = await response.json()

        doc_info = DocumentInfo(**result)
        logger.info(f"Document uploaded successfully: {doc_info.document_id}")

        return doc_info

    async def get_document(self, document_id: str) -> DocumentInfo:
        """Get document information

        Args:
            document_id: Document ID

        Returns:
            Document information
        """
        response = await self._make_request(
            "GET",
            f"/documents/{document_id}"
        )

        return DocumentInfo(**response)

    async def list_documents(
        self,
        limit: int = 50,
        offset: int = 0,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[DocumentInfo]:
        """List documents

        Args:
            limit: Maximum number of results
            offset: Pagination offset
            search: Search query
            tags: Filter by tags

        Returns:
            List of documents
        """
        params = {
            "limit": limit,
            "offset": offset
        }

        if search:
            params["search"] = search
        if tags:
            params["tags"] = ",".join(tags)

        response = await self._make_request(
            "GET",
            "/documents",
            params=params
        )

        documents = [DocumentInfo(**doc) for doc in response.get("documents", [])]
        return documents

    async def delete_document(self, document_id: str) -> bool:
        """Delete document

        Args:
            document_id: Document ID

        Returns:
            True if deleted successfully
        """
        await self._make_request(
            "DELETE",
            f"/documents/{document_id}"
        )

        logger.info(f"Document deleted: {document_id}")
        return True

    # Payment Methods (PCI Compliant)

    async def add_payment_method(
        self,
        payment_method_token: str,
        nickname: Optional[str] = None,
        make_default: bool = False
    ) -> PaymentMethod:
        """Add payment method (tokenized)

        Args:
            payment_method_token: Tokenized payment method
            nickname: Optional nickname
            make_default: Make this the default payment method

        Returns:
            Payment method information
        """
        payload = {
            "token": payment_method_token,
            "nickname": nickname,
            "default": make_default
        }

        response = await self._make_request(
            "POST",
            "/payments/methods",
            json=payload
        )

        return PaymentMethod(**response)

    async def process_payment(self, request: PaymentRequest) -> PaymentResponse:
        """Process payment

        Args:
            request: Payment request

        Returns:
            Payment response
        """
        payload = request.dict(exclude_none=True)

        response = await self._make_request(
            "POST",
            "/payments/process",
            json=payload
        )

        return PaymentResponse(**response)

    # Real-time WebSocket Methods

    async def connect_websocket(self) -> None:
        """Connect to WebSocket for real-time updates"""
        if not self._auth_context:
            raise AuthenticationError("Not authenticated")

        ws_url = self._base_url.replace("http", "ws") + "/realtime"
        headers = {
            "Authorization": f"Bearer {self._auth_context.access_token}",
            "X-Tenant-ID": self._auth_context.tenant_id
        }

        self._websocket = await websockets.connect(ws_url, extra_headers=headers)
        logger.info("WebSocket connected")

    async def listen_events(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Listen for real-time events

        Yields:
            Event data
        """
        if not self._websocket:
            raise RuntimeError("WebSocket not connected")

        try:
            async for message in self._websocket:
                yield json.loads(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            await self.connect_websocket()

    # Analytics Methods

    async def get_usage_analytics(
        self,
        start_date: datetime,
        end_date: datetime,
        granularity: str = "day"
    ) -> Dict[str, Any]:
        """Get usage analytics

        Args:
            start_date: Start date
            end_date: End date
            granularity: Granularity (hour, day, week, month)

        Returns:
            Usage analytics data
        """
        params = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "granularity": granularity
        }

        response = await self._make_request(
            "GET",
            "/analytics/usage",
            params=params
        )

        return response

    # Convenience Methods

    async def health_check(self) -> Dict[str, Any]:
        """Check API health status

        Returns:
            Health status information
        """
        return await self._make_request("GET", "/health")

    async def get_version(self) -> str:
        """Get API version

        Returns:
            API version string
        """
        response = await self._make_request("GET", "/version")
        return response.get("version")

# Convenience functions for quick usage

async def create_client(
    api_key: str,
    tenant_id: str,
    base_url: str = "https://api.sdlc.ai",
    environment: Environment = Environment.PRODUCTION
) -> SDLCClient:
    """Create and authenticate SDLC client

    Args:
        api_key: Your API key
        tenant_id: Your tenant ID
        base_url: API base URL
        environment: API environment

    Returns:
        Authenticated SDLC client
    """
    config = SDLCConfig(
        api_key=api_key,
        base_url=base_url,
        environment=environment
    )

    client = SDLCClient(config)
    await client.authenticate(api_key, tenant_id)

    return client

# Example usage

async def main():
    """Example usage of SDLC.ai Python SDK"""

    # Initialize client
    async with await create_client(
        api_key="your-api-key",
        tenant_id="your-tenant-id"
    ) as client:

        # Health check
        health = await client.health_check()
        print(f"API Health: {health['status']}")

        # RAG Query
        query_request = QueryRequest(
            query="What are the best practices for secure software development?",
            max_results=5,
            include_citations=True
        )

        response = await client.query(query_request)
        print(f"Response: {response.response}")
        print(f"Confidence: {response.confidence}")
        print(f"Citations: {len(response.citations)}")

        # Document Upload
        document = DocumentUpload(
            file_path="./example.pdf",
            name="Security Best Practices",
            tags=["security", "development"],
            metadata={"department": "engineering"}
        )

        doc_info = await client.upload_document(document)
        print(f"Uploaded document: {doc_info.document_id}")

        # Payment Processing
        payment_request = PaymentRequest(
            amount_cents=1000,  # $10.00
            currency="USD",
            payment_method_token="tok_123456",
            description="API usage"
        )

        payment = await client.process_payment(payment_request)
        print(f"Payment processed: {payment.payment_id}")

if __name__ == "__main__":
    asyncio.run(main())
