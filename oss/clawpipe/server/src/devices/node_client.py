#!/usr/bin/env python3
"""
FinSavvyAI Device Node Client — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - device_connection: Capability, NodeRegistration, DeviceNodeClient
  - device_capabilities: all capability classes
"""

from src.devices.device_capabilities import (
    CameraCapability,
    CanvasCapability,
    LocationCapability,
    NotificationCapability,
    ScreenCapability,
    SMSCapability,
    VoiceCapability,
)
from src.devices.device_connection import (
    Capability,
    DeviceNodeClient,
    NodeRegistration,
)

__all__ = [
    "Capability",
    "NodeRegistration",
    "DeviceNodeClient",
    "CameraCapability",
    "ScreenCapability",
    "LocationCapability",
    "CanvasCapability",
    "NotificationCapability",
    "SMSCapability",
    "VoiceCapability",
]
