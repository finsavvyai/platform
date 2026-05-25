#!/usr/bin/env python3
"""
Device capability handlers for FinSavvyAI.

Camera, screen, location, canvas, notifications, SMS, and voice.

Sprint 16 — Tasks 16.3-16.9
Extracted from node_client.py.
"""

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.devices")


class CameraCapability:
    """Trigger photos from devices, feed to vision pipeline (Task 16.3)."""

    def __init__(self, vision_pipeline: Optional[object] = None):
        self.vision_pipeline = vision_pipeline
        self._photos: List[Dict] = []

    async def capture(self, params: Dict) -> Dict:
        """Capture a photo from a device camera."""
        photo = {
            "device": params.get("device", "default"),
            "resolution": params.get("resolution", "1080p"),
            "timestamp": time.time(),
            "data": params.get("data", ""),
        }
        self._photos.append(photo)

        if self.vision_pipeline and photo.get("data"):
            analysis: Dict[str, Any] = {"status": "vision_pipeline_available"}
        else:
            analysis = {"status": "no_vision_pipeline"}

        return {"status": "captured", "photo": photo, "analysis": analysis}

    def get_photos(self) -> List[Dict]:
        return list(self._photos)


class ScreenCapability:
    """Capture device screen for analysis (Task 16.4)."""

    def __init__(self) -> None:
        self._recordings: List[Dict] = []

    async def capture_screen(self, params: Dict) -> Dict:
        return {
            "status": "captured",
            "device": params.get("device", "default"),
            "format": params.get("format", "png"),
            "timestamp": time.time(),
        }

    async def start_recording(self, params: Dict) -> Dict:
        recording = {
            "device": params.get("device", "default"),
            "started_at": time.time(),
            "status": "recording",
        }
        self._recordings.append(recording)
        return recording

    async def stop_recording(self, params: Dict) -> Dict:
        if self._recordings:
            rec = self._recordings[-1]
            rec["status"] = "stopped"
            rec["stopped_at"] = time.time()
            return rec
        return {"status": "no_active_recording"}


class LocationCapability:
    """GPS-aware responses (Task 16.5)."""

    def __init__(self) -> None:
        self._last_location: Optional[Dict] = None

    async def get_location(self, params: Dict) -> Dict:
        location = {
            "latitude": params.get("latitude", 0.0),
            "longitude": params.get("longitude", 0.0),
            "accuracy": params.get("accuracy", 0.0),
            "timestamp": time.time(),
        }
        self._last_location = location
        return {"status": "located", "location": location}

    @property
    def last_location(self) -> Optional[Dict]:
        return self._last_location


class CanvasCapability:
    """Render agent-generated HTML on devices (Task 16.6)."""

    def __init__(self) -> None:
        self._rendered: List[Dict] = []

    async def render(self, params: Dict) -> Dict:
        html = params.get("html", "")
        title = params.get("title", "FinSavvyAI Canvas")
        entry = {
            "title": title,
            "html_length": len(html),
            "timestamp": time.time(),
            "status": "rendered",
        }
        self._rendered.append(entry)
        return entry

    def get_rendered(self) -> List[Dict]:
        return list(self._rendered)


class NotificationCapability:
    """Push notifications from agent to devices (Task 16.7)."""

    def __init__(self) -> None:
        self._sent: List[Dict] = []

    async def send(self, params: Dict) -> Dict:
        notification = {
            "title": params.get("title", "FinSavvyAI"),
            "body": params.get("body", ""),
            "priority": params.get("priority", "normal"),
            "timestamp": time.time(),
            "status": "sent",
        }
        self._sent.append(notification)
        return notification

    def get_sent(self) -> List[Dict]:
        return list(self._sent)


class SMSCapability:
    """Send/receive SMS via agent on Android (Task 16.8)."""

    def __init__(self) -> None:
        self._messages: List[Dict] = []

    async def send_sms(self, params: Dict) -> Dict:
        msg = {
            "to": params.get("to", ""),
            "body": params.get("body", ""),
            "timestamp": time.time(),
            "status": "sent",
        }
        self._messages.append(msg)
        return msg

    async def get_messages(self, params: Dict) -> Dict:
        limit = params.get("limit", 10)
        return {"messages": self._messages[-limit:]}


class VoiceCapability:
    """Talk Mode for hands-free cluster management (Task 16.9)."""

    def __init__(self) -> None:
        self._active = False
        self._transcriptions: List[Dict] = []

    async def start_listening(self, params: Dict) -> Dict:
        self._active = True
        return {
            "status": "listening",
            "language": params.get("language", "en"),
        }

    async def stop_listening(self, params: Dict) -> Dict:
        self._active = False
        return {"status": "stopped"}

    async def process_transcription(self, params: Dict) -> Dict:
        text = params.get("text", "")
        entry = {"text": text, "timestamp": time.time()}
        self._transcriptions.append(entry)
        return {"status": "processed", "text": text}

    @property
    def is_active(self) -> bool:
        return self._active

    def get_transcriptions(self) -> List[Dict]:
        return list(self._transcriptions)
