"""
Enhanced Multi-Factor Authentication (MFA) Service

This service provides comprehensive MFA support including:
- Time-based One-Time Password (TOTP) authentication
- SMS-based authentication fallback
- Backup code generation and validation
- MFA enforcement policies
- Recovery mechanisms
- Rate limiting and security controls
- Comprehensive audit logging

Author: Claude Code Implementation
Updated: 2025-01-06
"""

import pyotp
import qrcode
import io
import base64
import secrets
import string
import json
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from cryptography.fernet import Fernet
import logging

try:
    from twilio.rest import Client
    from twilio.base.exceptions import TwilioRestException
    TWILIO_AVAILABLE = True
except ImportError:
    TWILIO_AVAILABLE = False

from app.models.user import User
from app.core.config import settings

logger = logging.getLogger(__name__)


class MFAMethod:
    """MFA method constants"""
    TOTP = "totp"
    SMS = "sms"
    BACKUP_CODE = "backup_code"


class MFAEnforcementPolicy:
    """MFA enforcement policy levels"""
    OPTIONAL = "optional"
    REQUIRED_FOR_ADMINS = "required_for_admins"
    REQUIRED_FOR_ALL = "required_for_all"
    ROLE_BASED = "role_based"


class MFAService:
    """
    Enhanced Multi-Factor Authentication service

    Provides comprehensive MFA support with TOTP, SMS, backup codes,
    enforcement policies, and recovery mechanisms.
    """

    def __init__(self):
        # Initialize encryption for storing MFA secrets
        self.cipher_suite = Fernet(self._get_or_create_mfa_key())

        # Initialize SMS client if available
        self.sms_client = None
        if settings.SMS_ENABLED and TWILIO_AVAILABLE:
            try:
                self.sms_client = Client(
                    settings.TWILIO_ACCOUNT_SID,
                    settings.TWILIO_AUTH_TOKEN
                )
                logger.info("SMS client initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize SMS client: {e}")

    def _get_or_create_mfa_key(self) -> bytes:
        """Get or create MFA encryption key from environment or generate new one"""
        mfa_key = getattr(settings, 'MFA_ENCRYPTION_KEY', None)
        if mfa_key:
            # Use provided key (ensure it's properly encoded)
            if isinstance(mfa_key, str):
                return mfa_key.encode()
            return mfa_key

        # Generate a new key (in production, this should be stored securely)
        key = Fernet.generate_key()
        logger.warning(
            "Generated new MFA encryption key. Store this securely in MFA_ENCRYPTION_KEY!"
        )
        return key

    def encrypt_secret(self, secret: str) -> str:
        """Encrypt MFA secret for secure storage"""
        encrypted_secret = self.cipher_suite.encrypt(secret.encode())
        return base64.b64encode(encrypted_secret).decode()

    def decrypt_secret(self, encrypted_secret: str) -> str:
        """Decrypt MFA secret from storage"""
        encrypted_data = base64.b64decode(encrypted_secret.encode())
        decrypted_secret = self.cipher_suite.decrypt(encrypted_data)
        return decrypted_secret.decode()

    def generate_totp_secret(self) -> str:
        """Generate a new TOTP secret"""
        return pyotp.random_base32()

    def generate_backup_codes(self, count: int = None) -> List[str]:
        """Generate secure backup codes for MFA recovery"""
        if count is None:
            count = settings.MFA_BACKUP_CODES_COUNT

        codes = []
        for _ in range(count):
            # Generate 8-character alphanumeric code
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits)
                          for _ in range(8))
            # Format as XXXX-XXXX for better readability
            codes.append(f"{code[:4]}-{code[4:]}")

        return codes

    def generate_sms_code(self) -> str:
        """Generate a 6-digit SMS verification code"""
        return ''.join(secrets.choice(string.digits) for _ in range(6))

    async def setup_totp_mfa(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """
        Setup TOTP-based MFA for a user

        Returns:
            Dict containing secret, QR code, and backup codes
        """
        try:
            # Generate new TOTP secret
            secret = self.generate_totp_secret()
            encrypted_secret = self.encrypt_secret(secret)

            # Create TOTP instance
            totp = pyotp.TOTP(secret)

            # Generate provisioning URI for QR code
            provisioning_uri = totp.provisioning_uri(
                name=user.email,
                issuer_name=settings.MFA_ISSUER
            )

            # Generate QR code
            qr = qrcode.QRCode(
                version=1,
                box_size=10,
                border=5,
                error_correction=qrcode.constants.ERROR_CORRECT_L
            )
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            # Convert QR code to base64 image
            img = qr.make_image(fill_color="black", back_color="white")
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            qr_code_base64 = base64.b64encode(img_buffer.getvalue()).decode()

            # Generate backup codes
            backup_codes = self.generate_backup_codes()

            # Initialize user preferences if needed
            if not user.preferences:
                user.preferences = {}

            # Store encrypted MFA data (not enabled yet)
            user.preferences.update({
                'mfa_method': MFAMethod.TOTP,
                'mfa_secret': encrypted_secret,
                'mfa_enabled': False,  # Will be enabled after verification
                'mfa_backup_codes': backup_codes,
                'mfa_setup_date': datetime.utcnow().isoformat(),
                'mfa_verification_attempts': 0,
                'mfa_last_attempt': None
            })

            await db.commit()

            logger.info(f"TOTP MFA setup initiated for user {user.id}")

            return {
                'secret': secret,
                'qr_code': f"data:image/png;base64,{qr_code_base64}",
                'backup_codes': backup_codes,
                'instructions': {
                    'step1': 'Scan the QR code with your authenticator app',
                    'step2': 'Enter the 6-digit code to verify setup',
                    'step3': 'Save the backup codes securely for account recovery'
                }
            }

        except Exception as e:
            logger.error(f"Error setting up TOTP MFA for user {user.id}: {e}")
            await db.rollback()
            raise

    async def setup_sms_mfa(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """
        Setup SMS-based MFA for a user

        Returns:
            Dict containing setup status and verification details
        """
        try:
            if not self.sms_client:
                raise ValueError("SMS service is not available")

            if not user.phone_number:
                raise ValueError("Phone number is required for SMS MFA")

            # Generate and send verification code
            verification_code = self.generate_sms_code()

            # Send SMS
            success = await self._send_sms_verification(
                phone_number=user.phone_number,
                code=verification_code,
                purpose="MFA setup"
            )

            if not success:
                raise ValueError("Failed to send verification SMS")

            # Initialize user preferences if needed
            if not user.preferences:
                user.preferences = {}

            # Store SMS setup data
            user.preferences.update({
                'mfa_method': MFAMethod.SMS,
                'mfa_enabled': False,  # Will be enabled after verification
                'mfa_sms_verification_code': verification_code,
                'mfa_sms_code_expires': (datetime.utcnow() + timedelta(minutes=10)).isoformat(),
                'mfa_setup_date': datetime.utcnow().isoformat(),
                'mfa_verification_attempts': 0,
                'mfa_last_attempt': None
            })

            await db.commit()

            logger.info(f"SMS MFA setup initiated for user {user.id}")

            return {
                'method': MFAMethod.SMS,
                'phone_number': user.phone_number,
                'verification_sent': True,
                'code_expires_minutes': 10,
                'instructions': {
                    'step1': f'A verification code has been sent to {user.phone_number}',
                    'step2': 'Enter the 6-digit code to verify setup',
                    'step3': 'Keep your phone available for future logins'
                }
            }

        except Exception as e:
            logger.error(f"Error setting up SMS MFA for user {user.id}: {e}")
            await db.rollback()
            raise

    async def verify_mfa_setup(self, db: AsyncSession, user: User, verification_code: str) -> Dict[str, Any]:
        """
        Verify MFA setup and enable it for the user

        Args:
            user: User object
            verification_code: TOTP code or SMS verification code

        Returns:
            Dict containing verification status and user MFA info
        """
        try:
            if not user.preferences:
                return {'success': False, 'error': 'MFA setup not initiated'}

            mfa_method = user.preferences.get('mfa_method')

            if mfa_method == MFAMethod.TOTP:
                success = await self._verify_totp_setup(user, verification_code)
            elif mfa_method == MFAMethod.SMS:
                success = await self._verify_sms_setup(db, user, verification_code)
            else:
                return {'success': False, 'error': 'Invalid MFA method'}

            if success:
                # Generate new backup codes for successful verification
                backup_codes = self.generate_backup_codes()
                user.preferences['mfa_backup_codes'] = backup_codes

                # Clear verification-specific data
                user.preferences.pop('mfa_sms_verification_code', None)
                user.preferences.pop('mfa_sms_code_expires', None)

                # Enable MFA
                user.preferences['mfa_enabled'] = True
                user.preferences['mfa_enabled_date'] = datetime.utcnow().isoformat()

                # Reset attempt counters
                user.preferences['mfa_verification_attempts'] = 0
                user.preferences['mfa_last_attempt'] = None

                await db.commit()

                logger.info(f"MFA successfully enabled for user {user.id} using {mfa_method}")

                return {
                    'success': True,
                    'mfa_enabled': True,
                    'mfa_method': mfa_method,
                    'backup_codes': backup_codes,
                    'message': f'MFA has been successfully enabled using {mfa_method.upper()}'
                }
            else:
                return {'success': False, 'error': 'Invalid verification code'}

        except Exception as e:
            logger.error(f"Error verifying MFA setup for user {user.id}: {e}")
            return {'success': False, 'error': 'Verification failed'}

    async def _verify_totp_setup(self, user: User, token: str) -> bool:
        """Verify TOTP token during setup"""
        try:
            encrypted_secret = user.preferences.get('mfa_secret')
            if not encrypted_secret:
                return False

            secret = self.decrypt_secret(encrypted_secret)
            totp = pyotp.TOTP(secret)

            return totp.verify(token, valid_window=settings.MFA_TOTP_VALIDITY_WINDOW)

        except Exception as e:
            logger.error(f"Error verifying TOTP setup for user {user.id}: {e}")
            return False

    async def _verify_sms_setup(self, db: AsyncSession, user: User, code: str) -> bool:
        """Verify SMS code during setup"""
        try:
            stored_code = user.preferences.get('mfa_sms_verification_code')
            expires_str = user.preferences.get('mfa_sms_code_expires')

            if not stored_code or not expires_str:
                return False

            # Check expiration
            expires_at = datetime.fromisoformat(expires_str.replace('Z', '+00:00'))
            if datetime.utcnow() > expires_at:
                return False

            # Verify code
            return code == stored_code

        except Exception as e:
            logger.error(f"Error verifying SMS setup for user {user.id}: {e}")
            return False

    async def verify_mfa_token(self, user: User, token: str, context: str = "login") -> Dict[str, Any]:
        """
        Verify MFA token for authentication

        Args:
            user: User object
            token: MFA token (TOTP or backup code)
            context: Verification context (login, recovery, etc.)

        Returns:
            Dict containing verification result and metadata
        """
        try:
            # Check if MFA is enabled
            if not self.is_mfa_enabled(user):
                return {'success': True, 'mfa_required': False}

            # Rate limiting check
            rate_limited = await self._check_rate_limit(user)
            if rate_limited:
                return {
                    'success': False,
                    'error': 'Too many attempts. Please try again later.',
                    'retry_after': settings.MFA_COOLDOWN_MINUTES * 60
                }

            success = False
            method_used = None

            # Check if it's a backup code first
            backup_result = await self._verify_and_consume_backup_code(user, token)
            if backup_result['success']:
                success = True
                method_used = MFAMethod.BACKUP_CODE
            else:
                # Try TOTP verification
                totp_result = await self._verify_totp_token(user, token)
                if totp_result['success']:
                    success = True
                    method_used = MFAMethod.TOTP

            # Update attempt tracking
            await self._update_verification_attempt(user, success)

            if success:
                logger.info(f"MFA verification successful for user {user.id} using {method_used}")
                return {
                    'success': True,
                    'mfa_required': True,
                    'method_used': method_used,
                    'backup_codes_remaining': len(user.preferences.get('mfa_backup_codes', []))
                }
            else:
                logger.warning(f"MFA verification failed for user {user.id}")
                return {
                    'success': False,
                    'error': 'Invalid authentication code',
                    'attempts_remaining': max(0, settings.MFA_MAX_ATTEMPTS -
                                            user.preferences.get('mfa_verification_attempts', 0))
                }

        except Exception as e:
            logger.error(f"Error verifying MFA token for user {user.id}: {e}")
            return {'success': False, 'error': 'Verification failed'}

    async def _verify_totp_token(self, user: User, token: str) -> Dict[str, Any]:
        """Verify TOTP token"""
        try:
            if not user.preferences:
                return {'success': False}

            encrypted_secret = user.preferences.get('mfa_secret')
            if not encrypted_secret:
                return {'success': False}

            secret = self.decrypt_secret(encrypted_secret)
            totp = pyotp.TOTP(secret)

            valid = totp.verify(token, valid_window=settings.MFA_TOTP_VALIDITY_WINDOW)
            return {'success': valid}

        except Exception as e:
            logger.error(f"Error verifying TOTP token for user {user.id}: {e}")
            return {'success': False}

    async def _verify_and_consume_backup_code(self, user: User, code: str) -> Dict[str, Any]:
        """Verify and consume a backup code"""
        try:
            if not user.preferences:
                return {'success': False}

            backup_codes = user.preferences.get('mfa_backup_codes', [])

            if code in backup_codes:
                # Remove used backup code
                backup_codes.remove(code)
                user.preferences['mfa_backup_codes'] = backup_codes

                logger.info(f"Backup code used for user {user.id}")
                return {
                    'success': True,
                    'backup_codes_remaining': len(backup_codes)
                }

            return {'success': False}

        except Exception as e:
            logger.error(f"Error verifying backup code for user {user.id}: {e}")
            return {'success': False}

    async def _check_rate_limit(self, user: User) -> bool:
        """Check if user is rate limited for MFA attempts"""
        try:
            if not user.preferences:
                return False

            attempts = user.preferences.get('mfa_verification_attempts', 0)
            last_attempt_str = user.preferences.get('mfa_last_attempt')

            if attempts >= settings.MFA_MAX_ATTEMPTS and last_attempt_str:
                last_attempt = datetime.fromisoformat(last_attempt_str.replace('Z', '+00:00'))
                cooldown_end = last_attempt + timedelta(minutes=settings.MFA_COOLDOWN_MINUTES)

                if datetime.utcnow() < cooldown_end:
                    return True

            return False

        except Exception as e:
            logger.error(f"Error checking rate limit for user {user.id}: {e}")
            return False

    async def _update_verification_attempt(self, user: User, success: bool):
        """Update verification attempt tracking"""
        try:
            if not user.preferences:
                return

            if success:
                # Reset counters on success
                user.preferences['mfa_verification_attempts'] = 0
                user.preferences['mfa_last_attempt'] = None
            else:
                # Increment failed attempts
                current_attempts = user.preferences.get('mfa_verification_attempts', 0)
                user.preferences['mfa_verification_attempts'] = current_attempts + 1
                user.preferences['mfa_last_attempt'] = datetime.utcnow().isoformat()

        except Exception as e:
            logger.error(f"Error updating verification attempt for user {user.id}: {e}")

    async def send_sms_code(self, user: User) -> Dict[str, Any]:
        """Send SMS verification code for MFA"""
        try:
            if not self.sms_client:
                return {'success': False, 'error': 'SMS service not available'}

            if not user.phone_number:
                return {'success': False, 'error': 'Phone number not configured'}

            # Generate and send code
            code = self.generate_sms_code()
            success = await self._send_sms_verification(
                phone_number=user.phone_number,
                code=code,
                purpose="MFA authentication"
            )

            if success:
                # Store code temporarily (in production, use Redis with expiration)
                if not user.preferences:
                    user.preferences = {}

                user.preferences['mfa_sms_temp_code'] = code
                user.preferences['mfa_sms_temp_expires'] = (
                    datetime.utcnow() + timedelta(minutes=5)
                ).isoformat()

                return {
                    'success': True,
                    'message': 'Verification code sent',
                    'expires_minutes': 5
                }
            else:
                return {'success': False, 'error': 'Failed to send SMS'}

        except Exception as e:
            logger.error(f"Error sending SMS code for user {user.id}: {e}")
            return {'success': False, 'error': 'Failed to send verification code'}

    async def _send_sms_verification(self, phone_number: str, code: str, purpose: str) -> bool:
        """Send SMS verification using Twilio"""
        try:
            if not self.sms_client:
                return False

            message = self._create_sms_message(code, purpose)

            message_obj = self.sms_client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone_number
            )

            logger.info(f"SMS sent to {phone_number}: {message_obj.sid}")
            return True

        except TwilioRestException as e:
            logger.error(f"Twilio error sending SMS: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending SMS: {e}")
            return False

    def _create_sms_message(self, code: str, purpose: str) -> str:
        """Create SMS message for verification"""
        if purpose == "MFA setup":
            return f"[{settings.MFA_ISSUER}] Your MFA setup code is: {code}. This code expires in 10 minutes."
        elif purpose == "MFA authentication":
            return f"[{settings.MFA_ISSUER}] Your verification code is: {code}. This code expires in 5 minutes."
        else:
            return f"[{settings.MFA_ISSUER}] Your verification code is: {code}"

    async def disable_mfa(self, db: AsyncSession, user: User, password: str = None) -> Dict[str, Any]:
        """
        Disable MFA for a user

        Args:
            user: User object
            password: User password (for security verification)

        Returns:
            Dict containing operation result
        """
        try:
            # Security check: verify password if provided
            if password:
                from app.core.auth import verify_password
                if not verify_password(password, user.hashed_password):
                    return {'success': False, 'error': 'Invalid password'}

            if user.preferences:
                # Store audit info before disabling
                audit_info = {
                    'disabled_at': datetime.utcnow().isoformat(),
                    'previous_method': user.preferences.get('mfa_method'),
                    'was_enabled': user.preferences.get('mfa_enabled', False)
                }

                # Remove MFA-related preferences
                keys_to_remove = [
                    'mfa_method', 'mfa_secret', 'mfa_enabled', 'mfa_backup_codes',
                    'mfa_setup_date', 'mfa_enabled_date', 'mfa_verification_attempts',
                    'mfa_last_attempt', 'mfa_sms_verification_code', 'mfa_sms_code_expires'
                ]

                for key in keys_to_remove:
                    user.preferences.pop(key, None)

                # Store audit info
                user.preferences['mfa_disabled_audit'] = audit_info

                await db.commit()

                logger.info(f"MFA disabled for user {user.id}")
                return {
                    'success': True,
                    'message': 'MFA has been disabled successfully'
                }

            return {'success': False, 'error': 'MFA was not enabled'}

        except Exception as e:
            logger.error(f"Error disabling MFA for user {user.id}: {e}")
            await db.rollback()
            return {'success': False, 'error': 'Failed to disable MFA'}

    async def regenerate_backup_codes(self, db: AsyncSession, user: User) -> Dict[str, Any]:
        """Regenerate backup codes for a user"""
        try:
            if not self.is_mfa_enabled(user):
                return {'success': False, 'error': 'MFA is not enabled'}

            # Generate new backup codes
            new_codes = self.generate_backup_codes()

            if user.preferences:
                user.preferences['mfa_backup_codes'] = new_codes
                user.preferences['mfa_backup_codes_regenerated'] = datetime.utcnow().isoformat()

                await db.commit()

                logger.info(f"Backup codes regenerated for user {user.id}")
                return {
                    'success': True,
                    'backup_codes': new_codes,
                    'message': 'New backup codes generated successfully'
                }

            return {'success': False, 'error': 'Failed to regenerate backup codes'}

        except Exception as e:
            logger.error(f"Error regenerating backup codes for user {user.id}: {e}")
            await db.rollback()
            return {'success': False, 'error': 'Failed to regenerate backup codes'}

    def is_mfa_enabled(self, user: User) -> bool:
        """Check if MFA is enabled for a user"""
        return (user.preferences and
                user.preferences.get('mfa_enabled', False))

    def get_mfa_method(self, user: User) -> Optional[str]:
        """Get the MFA method configured for a user"""
        if not user.preferences:
            return None
        return user.preferences.get('mfa_method')

    def get_mfa_status(self, user: User) -> Dict[str, Any]:
        """Get comprehensive MFA status for a user"""
        try:
            if not user.preferences:
                return {
                    'enabled': False,
                    'method': None,
                    'setup_completed': False
                }

            backup_codes_count = len(user.preferences.get('mfa_backup_codes', []))

            status = {
                'enabled': user.preferences.get('mfa_enabled', False),
                'method': user.preferences.get('mfa_method'),
                'setup_completed': 'mfa_setup_date' in user.preferences,
                'backup_codes_remaining': backup_codes_count,
                'setup_date': user.preferences.get('mfa_setup_date'),
                'enabled_date': user.preferences.get('mfa_enabled_date'),
                'last_regenerated': user.preferences.get('mfa_backup_codes_regenerated'),
                'phone_number_configured': bool(user.phone_number),
                'sms_available': bool(self.sms_client)
            }

            # Add method-specific info
            if status['method'] == MFAMethod.TOTP:
                status['totp_configured'] = bool(user.preferences.get('mfa_secret'))
            elif status['method'] == MFAMethod.SMS:
                status['sms_configured'] = bool(user.phone_number)

            return status

        except Exception as e:
            logger.error(f"Error getting MFA status for user {user.id}: {e}")
            return {'enabled': False, 'error': 'Failed to get MFA status'}

    def should_enforce_mfa(self, user: User) -> Tuple[bool, str]:
        """
        Check if MFA should be enforced for a user based on policies

        Returns:
            Tuple of (should_enforce, reason)
        """
        # Policy from settings (in a real implementation, this could come from database)
        policy = getattr(settings, 'MFA_ENFORCEMENT_POLICY', MFAEnforcementPolicy.OPTIONAL)

        if policy == MFAEnforcementPolicy.OPTIONAL:
            return False, "MFA is optional"

        elif policy == MFAEnforcementPolicy.REQUIRED_FOR_ADMINS:
            if user.role in ['admin', 'staff', 'enterprise_admin']:
                if not self.is_mfa_enabled(user):
                    return True, "MFA is required for admin users"
            return False, "MFA not required for this user role"

        elif policy == MFAEnforcementPolicy.REQUIRED_FOR_ALL:
            if not self.is_mfa_enabled(user):
                return True, "MFA is required for all users"
            return False, "MFA is already enabled"

        elif policy == MFAEnforcementPolicy.ROLE_BASED:
            # Define role-based requirements
            mfa_required_roles = ['admin', 'staff', 'enterprise_admin']
            mfa_recommended_roles = ['user']

            if user.role in mfa_required_roles:
                if not self.is_mfa_enabled(user):
                    return True, f"MFA is required for {user.role} role"
                return False, f"MFA is enabled for {user.role} role"
            elif user.role in mfa_recommended_roles:
                return False, f"MFA is recommended for {user.role} role"

        return False, "MFA enforcement policy not applicable"

    async def get_mfa_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get MFA usage statistics for reporting"""
        try:
            # This would require database queries to get comprehensive stats
            # For now, return basic structure
            return {
                'total_users': 0,  # Query from database
                'mfa_enabled_users': 0,  # Query from database
                'mfa_disabled_users': 0,  # Query from database
                'totp_users': 0,  # Query from database
                'sms_users': 0,  # Query from database
                'enforcement_policy': getattr(settings, 'MFA_ENFORCEMENT_POLICY', 'optional'),
                'last_updated': datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting MFA statistics: {e}")
            return {'error': 'Failed to get statistics'}