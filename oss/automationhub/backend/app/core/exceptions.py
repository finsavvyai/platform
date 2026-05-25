"""
Custom exceptions for the UPM.Plus application
"""

from typing import Optional, Dict, Any


class UPMPException(Exception):
    """Base exception for all UPM.Plus exceptions"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(UPMPException):
    """Raised when validation fails"""
    pass


class NotFoundError(UPMPException):
    """Raised when a resource is not found"""
    pass


class ConflictError(UPMPException):
    """Raised when a resource conflict occurs"""
    pass


class AuthorizationError(UPMPException):
    """Raised when authorization fails"""
    pass


class ProcessingError(UPMPException):
    """Raised when processing fails"""
    pass


class SecurityError(UPMPException):
    """Raised when a security issue is detected"""
    pass


class TaskExecutionError(UPMPException):
    """Raised when task execution fails"""
    pass


class AgentError(UPMPException):
    """Raised when an agent operation fails"""
    pass


class WorkflowError(UPMPException):
    """Raised when a workflow operation fails"""
    pass


