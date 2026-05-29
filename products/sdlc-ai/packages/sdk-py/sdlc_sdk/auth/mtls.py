"""
mTLS (mutual TLS) authentication for SDLC.ai SDK

Implements client certificate authentication for enhanced security.
"""

import ssl
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import structlog

from .base import BaseAuth
from ..exceptions import AuthenticationError

logger = structlog.get_logger("sdlc_sdk.auth.mtls")


class MTLSAuth(BaseAuth):
    """
    Mutual TLS authentication using client certificates.

    This method provides the highest level of security by requiring
    both the client and server to present valid certificates.
    """

    def __init__(
        self,
        cert_path: Optional[str] = None,
        key_path: Optional[str] = None,
        cert_data: Optional[bytes] = None,
        key_data: Optional[bytes] = None,
        password: Optional[str] = None,
        ca_cert_path: Optional[str] = None,
        verify_hostname: bool = True,
    ):
        """
        Initialize mTLS authentication.

        Args:
            cert_path: Path to client certificate file
            key_path: Path to client private key file
            cert_data: Certificate data as bytes
            key_data: Private key data as bytes
            password: Password for encrypted private key
            ca_cert_path: Path to CA certificate for verification
            verify_hostname: Whether to verify server hostname
        """
        super().__init__()

        # Load certificate and key
        if cert_path:
            self.cert_path = Path(cert_path)
            if not self.cert_path.exists():
                raise AuthenticationError(
                    message=f"Certificate file not found: {cert_path}",
                    code="CERT_NOT_FOUND",
                )
            self.cert_data = self.cert_path.read_bytes()
        elif cert_data:
            self.cert_data = cert_data
            self.cert_path = None
        else:
            raise AuthenticationError(
                message="Certificate path or data required", code="CERT_REQUIRED"
            )

        if key_path:
            self.key_path = Path(key_path)
            if not self.key_path.exists():
                raise AuthenticationError(
                    message=f"Private key file not found: {key_path}",
                    code="KEY_NOT_FOUND",
                )
            self.key_data = self.key_path.read_bytes()
        elif key_data:
            self.key_data = key_data
            self.key_path = None
        else:
            raise AuthenticationError(
                message="Private key path or data required", code="KEY_REQUIRED"
            )

        self.password = password
        self.ca_cert_path = ca_cert_path
        self.verify_hostname = verify_hostname

        # Create SSL context
        self.ssl_context = self._create_ssl_context()

    def _create_ssl_context(self) -> ssl.SSLContext:
        """
        Create SSL context for mTLS.

        Returns:
            Configured SSL context
        """
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

        # Load client certificate and key
        try:
            context.load_cert_chain(
                certfile=self.cert_path, keyfile=self.key_path, password=self.password
            )
        except Exception as e:
            # Try loading from data
            try:
                from tempfile import NamedTemporaryFile

                # Write cert to temp file
                with NamedTemporaryFile(
                    mode="wb", delete=False, suffix=".pem"
                ) as cert_file:
                    cert_file.write(self.cert_data)
                    temp_cert_path = cert_file.name

                # Write key to temp file
                with NamedTemporaryFile(
                    mode="wb", delete=False, suffix=".pem"
                ) as key_file:
                    key_file.write(self.key_data)
                    temp_key_path = key_file.name

                # Load from temp files
                context.load_cert_chain(
                    certfile=temp_cert_path,
                    keyfile=temp_key_path,
                    password=self.password,
                )

                # Clean up temp files
                Path(temp_cert_path).unlink(missing_ok=True)
                Path(temp_key_path).unlink(missing_ok=True)

            except Exception as e2:
                logger.error("Failed to load client certificate", error=str(e2))
                raise AuthenticationError(
                    message=f"Failed to load client certificate: {str(e2)}",
                    code="CERT_LOAD_FAILED",
                )

        # Load CA certificate if provided
        if self.ca_cert_path:
            try:
                context.load_verify_locations(cafile=self.ca_cert_path)
            except Exception as e:
                logger.error("Failed to load CA certificate", error=str(e))
                raise AuthenticationError(
                    message=f"Failed to load CA certificate: {str(e)}",
                    code="CA_CERT_LOAD_FAILED",
                )

        # Configure verification
        if not self.verify_hostname:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

        return context

    async def authenticate(self, client) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Authenticate using mTLS.

        The TLS handshake happens at the transport layer,
        so this just validates the connection.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        try:
            # Make a validation request
            response = await client._request(
                method="GET", endpoint="/auth/validate", ssl_context=self.ssl_context
            )

            if response.status_code == 200:
                data = response.json()
                self._authenticated = True
                self._auth_data = data

                # Store token if provided
                if data.get("token"):
                    self.token_manager.set_token(data["token"])

                logger.info("mTLS authentication successful")
                return True, data
            else:
                logger.error("mTLS validation failed", status_code=response.status_code)
                return False, None

        except Exception as e:
            logger.error("mTLS authentication error", error=str(e))
            raise AuthenticationError(
                message=f"mTLS authentication failed: {str(e)}", code="MTLS_AUTH_FAILED"
            )

    def get_headers(self) -> Dict[str, str]:
        """
        Get authentication headers.

        For mTLS, headers may not be needed but we include
        any JWT token if provided by the server.

        Returns:
            Dictionary of headers
        """
        headers = {}

        # Include JWT token if available
        if self.token_manager.get_token():
            headers["Authorization"] = f"Bearer {self.token_manager.get_token()}"

        # Add client certificate info
        headers["X-Client-Cert-Auth"] = "true"

        return headers

    def refresh(self) -> bool:
        """
        Refresh authentication.

        For mTLS, certificates don't expire frequently,
        but we can refresh the JWT token if needed.

        Returns:
            True if refresh was successful
        """
        # mTLS certificates are long-lived
        # Token refresh would be handled by token manager
        return True

    def is_authenticated(self) -> bool:
        """
        Check if authenticated.

        Returns:
            True if certificate is loaded
        """
        return self._authenticated or bool(self.cert_data and self.key_data)

    def get_ssl_context(self) -> ssl.SSLContext:
        """
        Get SSL context for HTTP client.

        Returns:
            SSL context configured for mTLS
        """
        return self.ssl_context
