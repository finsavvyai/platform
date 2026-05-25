"""
Comprehensive MFA Service Tests

This module provides complete test coverage for the Multi-Factor Authentication service,
including TOTP setup, SMS authentication, backup codes, enforcement policies, and
security controls.

Test Coverage:
- TOTP setup and verification
- SMS authentication flows
- Backup code generation and validation
- MFA enforcement policies
- Rate limiting and security controls
- Error handling and edge cases
- Integration with user model

Author: Claude Code Implementation
Updated: 2025-01-06
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timedelta
import pyotp
import base64

from app.services.mfa_service import MFAService, MFAMethod, MFAEnforcementPolicy
from app.models.user import User
from app.core.config import settings


@pytest.fixture
def mock_user():
    """Create a mock user for testing"""
    user = Mock(spec=User)
    user.id = "12345678-1234-5678-9abc-123456789abc"
    user.email = "test@example.com"
    user.phone_number = "+1234567890"
    user.preferences = {}
    user.role = "user"
    user.hashed_password = "hashed_password"
    return user


@pytest.fixture
def mock_db():
    """Create a mock database session"""
    return AsyncMock()


@pytest.fixture
def mfa_service():
    """Create MFA service instance with mocked dependencies"""
    with patch('app.services.mfa_service.settings') as mock_settings:
        mock_settings.MFA_ISSUER = "TestApp"
        mock_settings.MFA_TOTP_VALIDITY_WINDOW = 1
        mock_settings.MFA_BACKUP_CODES_COUNT = 5
        mock_settings.MFA_MAX_ATTEMPTS = 3
        mock_settings.MFA_COOLDOWN_MINUTES = 5
        mock_settings.SMS_ENABLED = False

        return MFAService()


@pytest.fixture
def mock_twilio_service():
    """Create a mock Twilio SMS service"""
    with patch('app.services.mfa_service.TWILIO_AVAILABLE', True), \
         patch('app.services.mfa_service.settings') as mock_settings:
        mock_settings.SMS_ENABLED = True
        mock_settings.TWILIO_ACCOUNT_SID = "test_sid"
        mock_settings.TWILIO_AUTH_TOKEN = "test_token"
        mock_settings.TWILIO_PHONE_NUMBER = "+1234567890"
        return True


class TestTOTPSetup:
    """Test TOTP-based MFA setup functionality"""

    @pytest.mark.asyncio
    async def test_setup_totp_mfa_success(self, mfa_service, mock_user, mock_db):
        """Test successful TOTP MFA setup"""
        result = await mfa_service.setup_totp_mfa(mock_db, mock_user)

        assert 'secret' in result
        assert 'qr_code' in result
        assert 'backup_codes' in result
        assert 'instructions' in result
        assert result['qr_code'].startswith('data:image/png;base64,')
        assert len(result['backup_codes']) == settings.MFA_BACKUP_CODES_COUNT
        assert all('-' in code for code in result['backup_codes'])

        # Verify user preferences were updated
        assert mock_user.preferences['mfa_method'] == MFAMethod.TOTP
        assert mock_user.preferences['mfa_enabled'] is False
        assert 'mfa_secret' in mock_user.preferences
        assert 'mfa_backup_codes' in mock_user.preferences

    @pytest.mark.asyncio
    async def test_setup_totp_mfa_database_error(self, mfa_service, mock_user, mock_db):
        """Test TOTP setup with database error"""
        mock_db.commit.side_effect = Exception("Database error")

        with pytest.raises(Exception):
            await mfa_service.setup_totp_mfa(mock_db, mock_user)

        mock_db.rollback.assert_called_once()


class TestSMSAuth:
    """Test SMS-based MFA functionality"""

    @pytest.mark.asyncio
    async def test_setup_sms_mfa_success(self, mfa_service, mock_twilio_service, mock_user, mock_db):
        """Test successful SMS MFA setup"""
        # Re-initialize service with SMS enabled
        with patch('app.services.mfa_service.Client') as mock_client:
            mock_twilio_client = Mock()
            mock_client.return_value = mock_twilio_client
            mock_twilio_client.messages.create.return_value = Mock(sid="test_message_sid")

            service = MFAService()
            result = await service.setup_sms_mfa(mock_db, mock_user)

            assert result['method'] == MFAMethod.SMS
            assert result['phone_number'] == mock_user.phone_number
            assert result['verification_sent'] is True
            assert result['code_expires_minutes'] == 10
            assert 'instructions' in result

            # Verify SMS was sent
            mock_twilio_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_setup_sms_mfa_no_phone(self, mfa_service, mock_twilio_service, mock_db):
        """Test SMS setup failure due to missing phone number"""
        user_no_phone = Mock(spec=User)
        user_no_phone.phone_number = None
        user_no_phone.preferences = {}

        with patch('app.services.mfa_service.Client'):
            service = MFAService()

            with pytest.raises(ValueError, match="Phone number is required"):
                await service.setup_sms_mfa(mock_db, user_no_phone)

    @pytest.mark.asyncio
    async def test_setup_sms_mfa_service_unavailable(self, mfa_service, mock_user, mock_db):
        """Test SMS setup failure when SMS service is unavailable"""
        with pytest.raises(ValueError, match="SMS service is not available"):
            await mfa_service.setup_sms_mfa(mock_db, mock_user)


class TestMFAVerification:
    """Test MFA verification functionality"""

    @pytest.mark.asyncio
    async def test_verify_totp_setup_success(self, mfa_service, mock_user, mock_db):
        """Test successful TOTP setup verification"""
        # Setup TOTP
        secret = pyotp.random_base32()
        encrypted_secret = mfa_service.encrypt_secret(secret)

        mock_user.preferences = {
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': encrypted_secret
        }

        # Generate valid TOTP token
        totp = pyotp.TOTP(secret)
        valid_token = totp.now()

        result = await mfa_service.verify_mfa_setup(mock_db, mock_user, valid_token)

        assert result['success'] is True
        assert result['mfa_enabled'] is True
        assert result['mfa_method'] == MFAMethod.TOTP
        assert 'backup_codes' in result
        assert mock_user.preferences['mfa_enabled'] is True

    @pytest.mark.asyncio
    async def test_verify_totp_setup_invalid_token(self, mfa_service, mock_user, mock_db):
        """Test TOTP setup verification with invalid token"""
        mock_user.preferences = {
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': mfa_service.encrypt_secret(pyotp.random_base32())
        }

        result = await mfa_service.verify_mfa_setup(mock_db, mock_user, "000000")

        assert result['success'] is False
        assert 'error' in result

    @pytest.mark.asyncio
    async def test_verify_mfa_token_success_totp(self, mfa_service, mock_user):
        """Test MFA token verification success with TOTP"""
        secret = pyotp.random_base32()
        encrypted_secret = mfa_service.encrypt_secret(secret)

        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': encrypted_secret,
            'mfa_backup_codes': ['ABCD-1234', 'EFGH-5678']
        }

        # Generate valid TOTP token
        totp = pyotp.TOTP(secret)
        valid_token = totp.now()

        result = await mfa_service.verify_mfa_token(mock_user, valid_token)

        assert result['success'] is True
        assert result['method_used'] == MFAMethod.TOTP
        assert result['backup_codes_remaining'] == 2

    @pytest.mark.asyncio
    async def test_verify_mfa_token_success_backup_code(self, mfa_service, mock_user):
        """Test MFA token verification success with backup code"""
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': mfa_service.encrypt_secret(pyotp.random_base32()),
            'mfa_backup_codes': ['ABCD-1234', 'EFGH-5678']
        }

        result = await mfa_service.verify_mfa_token(mock_user, 'ABCD-1234')

        assert result['success'] is True
        assert result['method_used'] == MFAMethod.BACKUP_CODE
        assert result['backup_codes_remaining'] == 1
        assert 'ABCD-1234' not in mock_user.preferences['mfa_backup_codes']

    @pytest.mark.asyncio
    async def test_verify_mfa_token_disabled_mfa(self, mfa_service, mock_user):
        """Test MFA token verification when MFA is disabled"""
        mock_user.preferences = {'mfa_enabled': False}

        result = await mfa_service.verify_mfa_token(mock_user, 'any_token')

        assert result['success'] is True
        assert result['mfa_required'] is False

    @pytest.mark.asyncio
    async def test_verify_mfa_token_rate_limiting(self, mfa_service, mock_user):
        """Test MFA token verification rate limiting"""
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_secret': mfa_service.encrypt_secret(pyotp.random_base32()),
            'mfa_verification_attempts': 3,  # Max attempts reached
            'mfa_last_attempt': (datetime.utcnow() - timedelta(minutes=1)).isoformat()
        }

        result = await mfa_service.verify_mfa_token(mock_user, 'any_token')

        assert result['success'] is False
        assert 'retry_after' in result
        assert 'too many attempts' in result['error'].lower()


class TestBackupCodes:
    """Test backup code functionality"""

    def test_generate_backup_codes(self, mfa_service):
        """Test backup code generation"""
        codes = mfa_service.generate_backup_codes(5)

        assert len(codes) == 5
        assert all(len(code) == 9 for code in codes)  # XXXX-XXXX format
        assert all('-' in code for code in codes)
        assert len(set(codes)) == 5  # All codes are unique

    def test_generate_sms_code(self, mfa_service):
        """Test SMS code generation"""
        code = mfa_service.generate_sms_code()

        assert len(code) == 6
        assert code.isdigit()

    @pytest.mark.asyncio
    async def test_regenerate_backup_codes_success(self, mfa_service, mock_user, mock_db):
        """Test successful backup code regeneration"""
        mock_user.preferences = {'mfa_enabled': True}

        result = await mfa_service.regenerate_backup_codes(mock_db, mock_user)

        assert result['success'] is True
        assert 'backup_codes' in result
        assert len(result['backup_codes']) == settings.MFA_BACKUP_CODES_COUNT
        assert 'mfa_backup_codes_regenerated' in mock_user.preferences

    @pytest.mark.asyncio
    async def test_regenerate_backup_codes_mfa_disabled(self, mfa_service, mock_user, mock_db):
        """Test backup code regeneration when MFA is disabled"""
        mock_user.preferences = {'mfa_enabled': False}

        result = await mfa_service.regenerate_backup_codes(mock_db, mock_user)

        assert result['success'] is False
        assert 'MFA is not enabled' in result['error']


class TestMFADisable:
    """Test MFA disable functionality"""

    @pytest.mark.asyncio
    async def test_disable_mfa_success(self, mfa_service, mock_user, mock_db):
        """Test successful MFA disable"""
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': 'encrypted_secret',
            'mfa_backup_codes': ['code1', 'code2']
        }

        result = await mfa_service.disable_mfa(mock_db, mock_user)

        assert result['success'] is True
        assert 'mfa_disabled_audit' in mock_user.preferences
        assert 'mfa_enabled' not in mock_user.preferences
        assert 'mfa_secret' not in mock_user.preferences

    @pytest.mark.asyncio
    async def test_disable_mfa_with_password_validation(self, mfa_service, mock_user, mock_db):
        """Test MFA disable with password validation"""
        mock_user.preferences = {'mfa_enabled': True}
        mock_user.hashed_password = "hashed_password"

        with patch('app.services.mfa_service.verify_password') as mock_verify:
            mock_verify.return_value = True

            result = await mfa_service.disable_mfa(mock_db, mock_user, "correct_password")

            assert result['success'] is True
            mock_verify.assert_called_once_with("correct_password", "hashed_password")

    @pytest.mark.asyncio
    async def test_disable_mfa_invalid_password(self, mfa_service, mock_user, mock_db):
        """Test MFA disable with invalid password"""
        mock_user.preferences = {'mfa_enabled': True}
        mock_user.hashed_password = "hashed_password"

        with patch('app.services.mfa_service.verify_password') as mock_verify:
            mock_verify.return_value = False

            result = await mfa_service.disable_mfa(mock_db, mock_user, "wrong_password")

            assert result['success'] is False
            assert 'Invalid password' in result['error']


class TestMFAEnforcement:
    """Test MFA enforcement policies"""

    @pytest.mark.asyncio
    async def test_should_enforce_mfa_optional(self, mfa_service, mock_user):
        """Test MFA enforcement with optional policy"""
        with patch('app.services.mfa_service.settings') as mock_settings:
            mock_settings.MFA_ENFORCEMENT_POLICY = MFAEnforcementPolicy.OPTIONAL

            should_enforce, reason = mfa_service.should_enforce_mfa(mock_user)

            assert should_enforce is False
            assert "optional" in reason.lower()

    @pytest.mark.asyncio
    async def test_should_enforce_mfa_admin_required(self, mfa_service, mock_user):
        """Test MFA enforcement for admin users"""
        with patch('app.services.mfa_service.settings') as mock_settings:
            mock_settings.MFA_ENFORCEMENT_POLICY = MFAEnforcementPolicy.REQUIRED_FOR_ADMINS
            mock_user.role = "admin"
            mock_user.preferences = {}

            should_enforce, reason = mfa_service.should_enforce_mfa(mock_user)

            assert should_enforce is True
            assert "admin" in reason.lower()

    @pytest.mark.asyncio
    async def test_should_enforce_mfa_admin_already_enabled(self, mfa_service, mock_user):
        """Test MFA enforcement for admin users with MFA already enabled"""
        with patch('app.services.mfa_service.settings') as mock_settings:
            mock_settings.MFA_ENFORCEMENT_POLICY = MFAEnforcementPolicy.REQUIRED_FOR_ADMINS
            mock_user.role = "admin"
            mock_user.preferences = {'mfa_enabled': True}

            should_enforce, reason = mfa_service.should_enforce_mfa(mock_user)

            assert should_enforce is False

    @pytest.mark.asyncio
    async def test_should_enforce_mfa_all_users(self, mfa_service, mock_user):
        """Test MFA enforcement for all users"""
        with patch('app.services.mfa_service.settings') as mock_settings:
            mock_settings.MFA_ENFORCEMENT_POLICY = MFAEnforcementPolicy.REQUIRED_FOR_ALL
            mock_user.preferences = {}

            should_enforce, reason = mfa_service.should_enforce_mfa(mock_user)

            assert should_enforce is True
            assert "all users" in reason.lower()


class TestMFAStatus:
    """Test MFA status functionality"""

    def test_get_mfa_status_enabled(self, mfa_service, mock_user):
        """Test MFA status when enabled"""
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_setup_date': '2023-01-01T00:00:00',
            'mfa_backup_codes': ['code1', 'code2', 'code3']
        }

        status = mfa_service.get_mfa_status(mock_user)

        assert status['enabled'] is True
        assert status['method'] == MFAMethod.TOTP
        assert status['setup_completed'] is True
        assert status['backup_codes_remaining'] == 3
        assert status['totp_configured'] is True

    def test_get_mfa_status_disabled(self, mfa_service, mock_user):
        """Test MFA status when disabled"""
        mock_user.preferences = {}

        status = mfa_service.get_mfa_status(mock_user)

        assert status['enabled'] is False
        assert status['method'] is None
        assert status['setup_completed'] is False
        assert status['backup_codes_remaining'] == 0

    def test_get_mfa_status_sms_method(self, mfa_service, mock_user):
        """Test MFA status for SMS method"""
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.SMS,
            'mfa_backup_codes': []
        }
        mock_user.phone_number = "+1234567890"

        status = mfa_service.get_mfa_status(mock_user)

        assert status['enabled'] is True
        assert status['method'] == MFAMethod.SMS
        assert status['sms_configured'] is True
        assert status['phone_number_configured'] is True

    def test_is_mfa_enabled_true(self, mfa_service, mock_user):
        """Test is_mfa_enabled when true"""
        mock_user.preferences = {'mfa_enabled': True}

        assert mfa_service.is_mfa_enabled(mock_user) is True

    def test_is_mfa_enabled_false(self, mfa_service, mock_user):
        """Test is_mfa_enabled when false"""
        mock_user.preferences = {'mfa_enabled': False}

        assert mfa_service.is_mfa_enabled(mock_user) is False

    def test_is_mfa_enabled_no_preferences(self, mfa_service, mock_user):
        """Test is_mfa_enabled with no preferences"""
        mock_user.preferences = None

        assert mfa_service.is_mfa_enabled(mock_user) is False


class TestEncryption:
    """Test MFA secret encryption functionality"""

    def test_encrypt_decrypt_secret(self, mfa_service):
        """Test secret encryption and decryption"""
        original_secret = "JBSWY3DPEHPK3PXP"

        # Encrypt
        encrypted = mfa_service.encrypt_secret(original_secret)
        assert encrypted != original_secret
        assert isinstance(encrypted, str)

        # Decrypt
        decrypted = mfa_service.decrypt_secret(encrypted)
        assert decrypted == original_secret

    def test_generate_totp_secret(self, mfa_service):
        """Test TOTP secret generation"""
        secret = mfa_service.generate_totp_secret()

        assert isinstance(secret, str)
        assert len(secret) >= 16  # Base32 encoded secrets are typically 16+ chars
        # Verify it's valid base32
        try:
            base64.b32decode(secret)
        except ValueError:
            pytest.fail("Generated secret is not valid base32")


class TestMFAStatistics:
    """Test MFA statistics functionality"""

    @pytest.mark.asyncio
    async def test_get_mfa_statistics(self, mfa_service, mock_db):
        """Test MFA statistics retrieval"""
        stats = await mfa_service.get_mfa_statistics(mock_db)

        assert 'total_users' in stats
        assert 'mfa_enabled_users' in stats
        assert 'enforcement_policy' in stats
        assert 'last_updated' in stats
        assert isinstance(stats['last_updated'], str)


class TestErrorHandling:
    """Test error handling and edge cases"""

    @pytest.mark.asyncio
    async def test_verify_mfa_setup_not_initiated(self, mfa_service, mock_user, mock_db):
        """Test MFA verification when setup not initiated"""
        mock_user.preferences = {}

        result = await mfa_service.verify_mfa_setup(mock_db, mock_user, "any_token")

        assert result['success'] is False
        assert 'not initiated' in result['error']

    @pytest.mark.asyncio
    async def test_verify_mfa_setup_invalid_method(self, mfa_service, mock_user, mock_db):
        """Test MFA verification with invalid method"""
        mock_user.preferences = {'mfa_method': 'invalid_method'}

        result = await mfa_service.verify_mfa_setup(mock_db, mock_user, "any_token")

        assert result['success'] is False
        assert 'Invalid MFA method' in result['error']

    def test_get_mfa_status_exception(self, mfa_service, mock_user):
        """Test MFA status with exception"""
        mock_user.preferences = Mock(side_effect=Exception("Test exception"))

        status = mfa_service.get_mfa_status(mock_user)

        assert status['enabled'] is False
        assert 'error' in status


class TestIntegration:
    """Integration tests for complete MFA flows"""

    @pytest.mark.asyncio
    async def test_complete_totp_flow(self, mfa_service, mock_user, mock_db):
        """Test complete TOTP setup and verification flow"""
        # Step 1: Setup TOTP
        setup_result = await mfa_service.setup_totp_mfa(mock_db, mock_user)

        assert 'secret' in setup_result
        assert 'qr_code' in setup_result
        secret = setup_result['secret']

        # Step 2: Verify TOTP setup
        totp = pyotp.TOTP(secret)
        valid_token = totp.now()

        verify_result = await mfa_service.verify_mfa_setup(mock_db, mock_user, valid_token)

        assert verify_result['success'] is True
        assert verify_result['mfa_enabled'] is True

        # Step 3: Test login verification
        login_result = await mfa_service.verify_mfa_token(mock_user, valid_token)

        assert login_result['success'] is True
        assert login_result['method_used'] == MFAMethod.TOTP

    @pytest.mark.asyncio
    async def test_complete_backup_code_flow(self, mfa_service, mock_user):
        """Test complete backup code usage flow"""
        # Setup MFA with backup codes
        backup_codes = ['ABCD-1234', 'EFGH-5678']
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': mfa_service.encrypt_secret(pyotp.random_base32()),
            'mfa_backup_codes': backup_codes.copy()
        }

        # Use backup code
        result = await mfa_service.verify_mfa_token(mock_user, 'ABCD-1234')

        assert result['success'] is True
        assert result['method_used'] == MFAMethod.BACKUP_CODE
        assert result['backup_codes_remaining'] == 1
        assert 'ABCD-1234' not in mock_user.preferences['mfa_backup_codes']

        # Try to use the same backup code again
        result2 = await mfa_service.verify_mfa_token(mock_user, 'ABCD-1234')

        assert result2['success'] is False

    @pytest.mark.asyncio
    async def test_disable_mfa_flow(self, mfa_service, mock_user, mock_db):
        """Test complete MFA disable flow"""
        # Setup MFA
        mock_user.preferences = {
            'mfa_enabled': True,
            'mfa_method': MFAMethod.TOTP,
            'mfa_secret': 'encrypted_secret',
            'mfa_backup_codes': ['code1', 'code2']
        }
        mock_user.hashed_password = "hashed_password"

        with patch('app.services.mfa_service.verify_password', return_value=True):
            # Disable MFA
            result = await mfa_service.disable_mfa(mock_db, mock_user, "password")

            assert result['success'] is True
            assert 'mfa_disabled_audit' in mock_user.preferences

            # Verify MFA is disabled
            assert not mfa_service.is_mfa_enabled(mock_user)