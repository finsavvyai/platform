"""
Voice Control API Endpoints
Voice-controlled workflow execution
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
import logging

from app.services.voice_control import (
    VoiceControlService,
    VoiceRequest,
    VoiceResponse,
    VoiceMode,
    VoiceCommand,
    voice_control_service
)
from app.core.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for API
class VoiceSessionRequest(BaseModel):
    """Request to start a voice session"""
    mode: VoiceMode = Field(default=VoiceMode.COMMAND, description="Voice interaction mode")


class VoiceSessionResponse(BaseModel):
    """Response for voice session creation"""
    session_id: str
    mode: str
    status: str = "active"
    created_at: str


class VoiceCommandResponse(BaseModel):
    """Response for voice command processing"""
    text_response: str
    command_type: str
    extracted_parameters: Optional[dict] = None
    workflow_id: Optional[str] = None
    success: bool
    confidence: float
    audio_available: bool = False


class VoiceCapabilitiesResponse(BaseModel):
    """Voice control capabilities"""
    supported_commands: list
    supported_modes: list
    languages_supported: list
    tts_available: bool
    active_sessions: int
    microphone_available: bool
    example_commands: list


@router.get("/health")
async def health_check():
    """Health check for voice control service"""
    return {
        "status": "healthy",
        "service": "voice_control",
        "tts_available": voice_control_service.tts_engine is not None,
        "microphone_available": voice_control_service.microphone is not None
    }


@router.get("/capabilities", response_model=VoiceCapabilitiesResponse)
async def get_voice_capabilities():
    """Get voice control capabilities and supported features"""
    capabilities = await voice_control_service.get_voice_capabilities()
    return VoiceCapabilitiesResponse(**capabilities)


@router.post("/sessions", response_model=VoiceSessionResponse)
async def start_voice_session(
    request: VoiceSessionRequest,
    current_user: User = Depends(get_current_user)
):
    """Start a new voice interaction session"""
    try:
        logger.info(f"Starting voice session for user {current_user.email} in {request.mode.value} mode")

        session_id = await voice_control_service.start_voice_session(
            user_id=str(current_user.id),
            mode=request.mode
        )

        return VoiceSessionResponse(
            session_id=session_id,
            mode=request.mode.value,
            created_at="2024-01-01T00:00:00Z"
        )

    except Exception as e:
        logger.error(f"Failed to start voice session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start voice session: {str(e)}")


@router.delete("/sessions/{session_id}")
async def end_voice_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """End a voice interaction session"""
    try:
        await voice_control_service.end_voice_session(session_id)
        return {"status": "session_ended", "session_id": session_id}

    except Exception as e:
        logger.error(f"Failed to end voice session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to end voice session: {str(e)}")


@router.post("/command", response_model=VoiceCommandResponse)
async def process_voice_command(
    audio: UploadFile = File(..., description="Audio file containing voice command"),
    session_id: Optional[str] = Form(None, description="Optional session ID for conversation mode"),
    mode: VoiceMode = Form(default=VoiceMode.COMMAND, description="Voice interaction mode"),
    language: str = Form(default="en-US", description="Language code for speech recognition"),
    current_user: User = Depends(get_current_user)
):
    """Process a voice command from audio file"""
    try:
        logger.info(f"Processing voice command for user {current_user.email}")

        # Validate audio file
        if not audio.content_type or not audio.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="Invalid audio file format")

        # Read audio data
        audio_data = await audio.read()

        if len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        # Create voice request
        voice_request = VoiceRequest(
            audio_data=audio_data,
            duration=len(audio_data) / 16000.0,  # Approximate duration
            user_id=str(current_user.id),
            session_id=session_id,
            language=language,
            mode=mode
        )

        # Process the voice request
        response = await voice_control_service.process_voice_request(voice_request)

        return VoiceCommandResponse(
            text_response=response.text_response,
            command_type=response.command_type.value,
            extracted_parameters=response.extracted_parameters,
            workflow_id=response.workflow_id,
            success=response.success,
            confidence=response.confidence,
            audio_available=response.audio_response is not None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice command processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Voice command processing failed: {str(e)}")


@router.get("/command/audio/{command_id}")
async def get_voice_response_audio(
    command_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get audio response for a processed voice command"""
    # In a real implementation, this would retrieve stored audio responses
    # For now, return a placeholder
    return {"message": "Audio response not available in this implementation"}


@router.post("/text-command", response_model=VoiceCommandResponse)
async def process_text_command(
    command: str = Form(..., description="Text command to process"),
    session_id: Optional[str] = Form(None, description="Optional session ID"),
    current_user: User = Depends(get_current_user)
):
    """Process a text command as if it were spoken (for testing and accessibility)"""
    try:
        logger.info(f"Processing text command for user {current_user.email}: {command}")

        # Convert text to voice request format (without actual audio)
        from app.services.voice_control import VoiceCommand
        import json

        # Analyze intent directly from text
        command_type, parameters, confidence = await voice_control_service._analyze_intent(command)

        # Execute the command
        response_text, workflow_id = await voice_control_service._execute_voice_command(
            command_type, parameters, str(current_user.id), command
        )

        return VoiceCommandResponse(
            text_response=response_text,
            command_type=command_type.value,
            extracted_parameters=parameters,
            workflow_id=workflow_id,
            success=True,
            confidence=confidence,
            audio_available=False
        )

    except Exception as e:
        logger.error(f"Text command processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text command processing failed: {str(e)}")


@router.get("/commands/examples")
async def get_command_examples():
    """Get example voice commands for different categories"""
    examples = {
        "workflow_management": [
            "Create a workflow to deploy a Node.js application",
            "Run my backup workflow",
            "Stop the deployment workflow",
            "Show me the status of my web server deployment"
        ],
        "code_generation": [
            "Generate Terraform code for an AWS VPC",
            "Create Ansible playbook for web server setup",
            "Write Kubernetes deployment for my app",
            "Generate Docker file for Python application"
        ],
        "infrastructure": [
            "Deploy a load balancer to AWS",
            "Provision a database server on Azure",
            "Set up monitoring for my Kubernetes cluster",
            "Scale up the production environment"
        ],
        "monitoring": [
            "Check the health of my servers",
            "Monitor the database performance",
            "Show me system metrics",
            "What's the status of all services"
        ],
        "general": [
            "List all my workflows",
            "Help me get started",
            "What can you do",
            "Show me recent activity"
        ]
    }
    return examples


@router.get("/sessions/{session_id}/history")
async def get_session_history(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get conversation history for a voice session"""
    if session_id in voice_control_service.active_sessions:
        session = voice_control_service.active_sessions[session_id]

        # Verify session belongs to current user
        if session.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Access denied to this session")

        return {
            "session_id": session_id,
            "mode": session.mode.value,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "conversation_history": session.conversation_history
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/sessions")
async def list_active_sessions(current_user: User = Depends(get_current_user)):
    """List active voice sessions for the current user"""
    user_sessions = []

    for session_id, session in voice_control_service.active_sessions.items():
        if session.user_id == str(current_user.id):
            user_sessions.append({
                "session_id": session_id,
                "mode": session.mode.value,
                "created_at": session.created_at.isoformat(),
                "last_activity": session.last_activity.isoformat(),
                "interactions": len(session.conversation_history)
            })

    return {"active_sessions": user_sessions}


@router.post("/test/microphone")
async def test_microphone(current_user: User = Depends(get_current_user)):
    """Test microphone availability and configuration"""
    try:
        # Test microphone accessibility
        microphone_available = voice_control_service.microphone is not None

        # In a real implementation, this would test actual microphone recording
        test_result = {
            "microphone_available": microphone_available,
            "sample_rate": 16000,
            "channels": 1,
            "bit_depth": 16,
            "status": "ready" if microphone_available else "unavailable"
        }

        if microphone_available:
            test_result["message"] = "Microphone is ready for voice commands"
        else:
            test_result["message"] = "Microphone not available. Please check your audio settings."

        return test_result

    except Exception as e:
        logger.error(f"Microphone test failed: {e}")
        return {
            "microphone_available": False,
            "status": "error",
            "message": f"Microphone test failed: {str(e)}"
        }


@router.post("/test/tts")
async def test_text_to_speech(
    text: str = Form(default="Hello! Voice control is working correctly.", description="Text to convert to speech"),
    current_user: User = Depends(get_current_user)
):
    """Test text-to-speech functionality"""
    try:
        # Test TTS engine
        tts_available = voice_control_service.tts_engine is not None

        if not tts_available:
            return {
                "tts_available": False,
                "status": "unavailable",
                "message": "Text-to-speech engine not available"
            }

        # Generate audio response
        audio_data = await voice_control_service._generate_audio_response(text)

        return {
            "tts_available": True,
            "status": "success",
            "message": "Text-to-speech is working correctly",
            "audio_generated": audio_data is not None,
            "audio_size_bytes": len(audio_data) if audio_data else 0
        }

    except Exception as e:
        logger.error(f"TTS test failed: {e}")
        return {
            "tts_available": False,
            "status": "error",
            "message": f"Text-to-speech test failed: {str(e)}"
        }