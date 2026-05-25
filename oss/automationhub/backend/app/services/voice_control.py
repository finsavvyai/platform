"""
Voice-Controlled Workflows Service
Voice commands to workflow execution
"""

import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import tempfile
import os
import threading

# Optional voice dependencies
try:
    import openai
    import speech_recognition as sr
    from pydub import AudioSegment
    from pydub.playback import play
    import pyttsx3
    VOICE_DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    VOICE_DEPENDENCIES_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"Voice control dependencies not available: {e}. Service will run in fallback mode.")

logger = logging.getLogger(__name__)


class VoiceCommand(Enum):
    """Supported voice command types"""
    CREATE_WORKFLOW = "create_workflow"
    EXECUTE_WORKFLOW = "execute_workflow"
    CHECK_STATUS = "check_status"
    STOP_WORKFLOW = "stop_workflow"
    LIST_WORKFLOWS = "list_workflows"
    GENERATE_CODE = "generate_code"
    DEPLOY_INFRASTRUCTURE = "deploy_infrastructure"
    MONITOR_SYSTEM = "monitor_system"
    HELP = "help"
    UNKNOWN = "unknown"


class VoiceMode(Enum):
    """Voice interaction modes"""
    COMMAND = "command"          # Single command execution
    CONVERSATION = "conversation"  # Multi-turn conversation
    DICTATION = "dictation"      # Continuous dictation mode


@dataclass
class VoiceRequest:
    """Voice request structure"""
    audio_data: bytes
    duration: float
    user_id: str
    session_id: Optional[str] = None
    language: str = "en-US"
    mode: VoiceMode = VoiceMode.COMMAND


@dataclass
class VoiceResponse:
    """Voice response structure"""
    text_response: str
    audio_response: Optional[bytes] = None
    command_type: VoiceCommand = VoiceCommand.UNKNOWN
    extracted_parameters: Dict[str, Any] = None
    workflow_id: Optional[str] = None
    success: bool = True
    confidence: float = 0.0


@dataclass
class VoiceSession:
    """Voice interaction session"""
    session_id: str
    user_id: str
    mode: VoiceMode
    context: Dict[str, Any]
    created_at: datetime
    last_activity: datetime
    conversation_history: List[Dict[str, str]]


class VoiceControlService:
    """
    Voice-controlled workflows service that enables users to control
    UPM.Plus through natural voice commands
    """

    def __init__(self):
        # Initialize OpenAI client with graceful fallback for testing
        try:
            self.openai_client = openai.AsyncOpenAI()
        except Exception as e:
            logger.warning(f"OpenAI client initialization failed: {e}. Using fallback mode.")
            self.openai_client = None

        # Initialize audio components with graceful fallback
        if not VOICE_DEPENDENCIES_AVAILABLE:
            logger.warning("Voice dependencies not available, audio features disabled")
            self.recognizer = None
            self.microphone = None
        else:
            try:
                self.recognizer = sr.Recognizer()
                self.microphone = sr.Microphone()
            except Exception as e:
                logger.warning(f"Audio components initialization failed: {e}. Audio features disabled.")
                self.recognizer = None
                self.microphone = None

        try:
            self.tts_engine = self._initialize_tts()
        except Exception as e:
            logger.warning(f"TTS engine initialization failed: {e}. TTS features disabled.")
            self.tts_engine = None
        self.active_sessions: Dict[str, VoiceSession] = {}
        self.command_patterns = self._load_command_patterns()

        # Calibrate microphone for ambient noise
        if self.microphone and self.recognizer:
            self._calibrate_microphone()

    def _initialize_tts(self) -> Optional[Any]:
        """Initialize text-to-speech engine"""
        if not VOICE_DEPENDENCIES_AVAILABLE:
            logger.warning("Voice dependencies not available, TTS disabled")
            return None
        try:
            engine = pyttsx3.init()

            # Configure voice settings
            voices = engine.getProperty('voices')
            if voices:
                # Prefer female voice if available
                for voice in voices:
                    if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                        engine.setProperty('voice', voice.id)
                        break
                else:
                    engine.setProperty('voice', voices[0].id)

            # Set speech rate and volume
            engine.setProperty('rate', 180)  # Words per minute
            engine.setProperty('volume', 0.8)  # Volume level (0.0 to 1.0)

            return engine

        except Exception as e:
            logger.error(f"Failed to initialize TTS engine: {e}")
            return None

    def _calibrate_microphone(self):
        """Calibrate microphone for ambient noise"""
        try:
            if self.microphone and self.recognizer:
                with self.microphone as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=1)
                logger.info("Microphone calibrated for ambient noise")
            else:
                logger.warning("Cannot calibrate microphone: components not initialized")
        except Exception as e:
            logger.error(f"Microphone calibration failed: {e}")

    def _load_command_patterns(self) -> Dict[VoiceCommand, List[str]]:
        """Load voice command patterns for recognition"""
        return {
            VoiceCommand.CREATE_WORKFLOW: [
                r"create (a )?workflow (to |that |for )?(.+)",
                r"make (a )?new workflow (to |that |for )?(.+)",
                r"build (a )?workflow (to |that |for )?(.+)",
                r"set up (a )?workflow (to |that |for )?(.+)"
            ],
            VoiceCommand.EXECUTE_WORKFLOW: [
                r"run (the )?workflow (.+)",
                r"execute (the )?workflow (.+)",
                r"start (the )?workflow (.+)",
                r"launch (the )?workflow (.+)"
            ],
            VoiceCommand.CHECK_STATUS: [
                r"(what's the |what is the )?status of (.+)",
                r"how is (.+) doing",
                r"check (the )?status of (.+)",
                r"show me (the )?status of (.+)"
            ],
            VoiceCommand.STOP_WORKFLOW: [
                r"stop (the )?workflow (.+)",
                r"cancel (the )?workflow (.+)",
                r"abort (the )?workflow (.+)",
                r"terminate (the )?workflow (.+)"
            ],
            VoiceCommand.LIST_WORKFLOWS: [
                r"(show me |list |what are )(my |all |the )?workflows",
                r"what workflows do i have",
                r"list all workflows",
                r"show workflows"
            ],
            VoiceCommand.GENERATE_CODE: [
                r"generate (.+) code (for |to |that )(.+)",
                r"create (.+) code (for |to |that )(.+)",
                r"write (.+) code (for |to |that )(.+)",
                r"make (.+) code (for |to |that )(.+)"
            ],
            VoiceCommand.DEPLOY_INFRASTRUCTURE: [
                r"deploy (.+) (to |on |in )(.+)",
                r"provision (.+) (on |in )(.+)",
                r"set up (.+) (infrastructure |servers |resources)",
                r"create (.+) (infrastructure |environment)"
            ],
            VoiceCommand.MONITOR_SYSTEM: [
                r"monitor (.+)",
                r"watch (.+)",
                r"check (.+) (health |status)",
                r"show me (.+) (metrics |performance)"
            ],
            VoiceCommand.HELP: [
                r"help",
                r"what can you do",
                r"how do i (.+)",
                r"show me (the )?commands"
            ]
        }

    async def process_voice_request(self, request: VoiceRequest) -> VoiceResponse:
        """Process a voice request and return appropriate response"""
        try:
            logger.info(f"Processing voice request for user {request.user_id}")

            # Convert audio to text
            transcribed_text = await self._transcribe_audio(request.audio_data)

            if not transcribed_text:
                return VoiceResponse(
                    text_response="I couldn't understand what you said. Could you please repeat?",
                    success=False,
                    confidence=0.0
                )

            logger.info(f"Transcribed: {transcribed_text}")

            # Analyze command intent
            command_type, parameters, confidence = await self._analyze_intent(transcribed_text)

            # Handle session context if in conversation mode
            if request.mode == VoiceMode.CONVERSATION:
                await self._update_session_context(request.session_id, transcribed_text, command_type)

            # Execute the command
            response_text, workflow_id = await self._execute_voice_command(
                command_type, parameters, request.user_id, transcribed_text
            )

            # Generate audio response
            audio_response = await self._generate_audio_response(response_text)

            return VoiceResponse(
                text_response=response_text,
                audio_response=audio_response,
                command_type=command_type,
                extracted_parameters=parameters,
                workflow_id=workflow_id,
                success=True,
                confidence=confidence
            )

        except Exception as e:
            logger.error(f"Voice request processing failed: {e}")
            error_response = "I encountered an error processing your request. Please try again."
            return VoiceResponse(
                text_response=error_response,
                audio_response=await self._generate_audio_response(error_response),
                success=False,
                confidence=0.0
            )

    async def _transcribe_audio(self, audio_data: bytes) -> Optional[str]:
        """Transcribe audio to text using OpenAI Whisper"""
        try:
            # Save audio data to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name

            try:
                # Use OpenAI Whisper for transcription
                with open(temp_file_path, "rb") as audio_file:
                    transcript = await self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text"
                    )
                return transcript.strip()

            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"Audio transcription failed: {e}")

            # Fallback to local speech recognition
            try:
                return await self._transcribe_with_local_sr(audio_data)
            except Exception as fallback_error:
                logger.error(f"Fallback transcription failed: {fallback_error}")
                return None

    async def _transcribe_with_local_sr(self, audio_data: bytes) -> Optional[str]:
        """Fallback transcription using local speech recognition"""
        try:
            # Convert audio data to AudioData object
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name

            try:
                with sr.AudioFile(temp_file_path) as source:
                    audio = self.recognizer.record(source)

                # Use Google Speech Recognition as fallback
                text = self.recognizer.recognize_google(audio)
                return text

            finally:
                os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"Local speech recognition failed: {e}")
            return None

    async def _analyze_intent(self, text: str) -> Tuple[VoiceCommand, Dict[str, Any], float]:
        """Analyze intent from transcribed text"""
        text_lower = text.lower().strip()

        # First, try pattern matching
        for command, patterns in self.command_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text_lower)
                if match:
                    parameters = {}
                    groups = match.groups()

                    if command == VoiceCommand.CREATE_WORKFLOW:
                        parameters['description'] = groups[-1] if groups else text
                    elif command == VoiceCommand.EXECUTE_WORKFLOW:
                        parameters['workflow_name'] = groups[-1] if groups else text
                    elif command == VoiceCommand.CHECK_STATUS:
                        parameters['target'] = groups[-1] if groups else text
                    elif command == VoiceCommand.GENERATE_CODE:
                        if len(groups) >= 2:
                            parameters['code_type'] = groups[0]
                            parameters['description'] = groups[-1]
                    elif command == VoiceCommand.DEPLOY_INFRASTRUCTURE:
                        if len(groups) >= 2:
                            parameters['resource'] = groups[0]
                            parameters['target'] = groups[-1]

                    return command, parameters, 0.9

        # If no pattern matches, use AI to understand intent
        return await self._analyze_intent_with_ai(text)

    async def _analyze_intent_with_ai(self, text: str) -> Tuple[VoiceCommand, Dict[str, Any], float]:
        """Use AI to analyze complex voice commands"""
        try:
            prompt = f"""
            Analyze this voice command and determine the intent and parameters:
            Command: "{text}"

            Available command types:
            - create_workflow: Create a new workflow
            - execute_workflow: Run an existing workflow
            - check_status: Check status of workflows or systems
            - stop_workflow: Stop a running workflow
            - list_workflows: List available workflows
            - generate_code: Generate infrastructure code
            - deploy_infrastructure: Deploy infrastructure resources
            - monitor_system: Monitor system health
            - help: Get help or assistance
            - unknown: Command not recognized

            Respond with JSON:
            {{
                "command_type": "command_type_here",
                "parameters": {{"param1": "value1", "param2": "value2"}},
                "confidence": 0.85
            }}
            """

            response = await self.openai_client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a voice command analyzer. Extract intent and parameters from voice commands."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,
                max_tokens=500
            )

            result = json.loads(response.choices[0].message.content)

            command_type = VoiceCommand(result.get('command_type', 'unknown'))
            parameters = result.get('parameters', {})
            confidence = result.get('confidence', 0.5)

            return command_type, parameters, confidence

        except Exception as e:
            logger.error(f"AI intent analysis failed: {e}")
            return VoiceCommand.UNKNOWN, {}, 0.0

    async def _execute_voice_command(
        self,
        command_type: VoiceCommand,
        parameters: Dict[str, Any],
        user_id: str,
        original_text: str
    ) -> Tuple[str, Optional[str]]:
        """Execute the voice command and return response"""

        try:
            if command_type == VoiceCommand.CREATE_WORKFLOW:
                return await self._handle_create_workflow(parameters, user_id)

            elif command_type == VoiceCommand.EXECUTE_WORKFLOW:
                return await self._handle_execute_workflow(parameters, user_id)

            elif command_type == VoiceCommand.CHECK_STATUS:
                return await self._handle_check_status(parameters, user_id)

            elif command_type == VoiceCommand.LIST_WORKFLOWS:
                return await self._handle_list_workflows(user_id)

            elif command_type == VoiceCommand.GENERATE_CODE:
                return await self._handle_generate_code(parameters, user_id)

            elif command_type == VoiceCommand.DEPLOY_INFRASTRUCTURE:
                return await self._handle_deploy_infrastructure(parameters, user_id)

            elif command_type == VoiceCommand.MONITOR_SYSTEM:
                return await self._handle_monitor_system(parameters, user_id)

            elif command_type == VoiceCommand.HELP:
                return await self._handle_help_request(user_id)

            else:
                return self._handle_unknown_command(original_text)

        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            return f"I encountered an error executing your command: {str(e)}", None

    async def _handle_create_workflow(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, str]:
        """Handle workflow creation command"""
        description = parameters.get('description', 'New workflow')

        # In a real implementation, this would integrate with the workflow service
        workflow_id = f"wf_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        response = f"I've started creating a workflow for '{description}'. The workflow ID is {workflow_id}. It will be ready in a few moments."
        return response, workflow_id

    async def _handle_execute_workflow(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, str]:
        """Handle workflow execution command"""
        workflow_name = parameters.get('workflow_name', 'unknown workflow')

        # In a real implementation, this would integrate with the workflow execution service
        execution_id = f"exec_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        response = f"I'm starting the execution of '{workflow_name}'. Execution ID is {execution_id}. I'll notify you when it's complete."
        return response, execution_id

    async def _handle_check_status(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, None]:
        """Handle status check command"""
        target = parameters.get('target', 'system')

        # Mock status response
        response = f"The status of {target} is: Running normally. All systems are operational with 99.9% uptime."
        return response, None

    async def _handle_list_workflows(self, user_id: str) -> Tuple[str, None]:
        """Handle list workflows command"""
        # Mock workflow list
        workflows = [
            "Web Server Deployment",
            "Database Backup",
            "Log Analysis",
            "Security Scan"
        ]

        response = f"You have {len(workflows)} workflows: {', '.join(workflows)}."
        return response, None

    async def _handle_generate_code(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, None]:
        """Handle code generation command"""
        code_type = parameters.get('code_type', 'terraform')
        description = parameters.get('description', 'infrastructure')

        response = f"I'm generating {code_type} code for {description}. This will take a few seconds."
        return response, None

    async def _handle_deploy_infrastructure(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, str]:
        """Handle infrastructure deployment command"""
        resource = parameters.get('resource', 'infrastructure')
        target = parameters.get('target', 'AWS')

        deployment_id = f"deploy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        response = f"I'm deploying {resource} to {target}. Deployment ID is {deployment_id}. This may take several minutes."
        return response, deployment_id

    async def _handle_monitor_system(self, parameters: Dict[str, Any], user_id: str) -> Tuple[str, None]:
        """Handle system monitoring command"""
        target = parameters.get('target', 'all systems')

        response = f"I'm monitoring {target}. Current status: All services are healthy. CPU usage: 15%, Memory: 45%, Disk: 60%."
        return response, None

    async def _handle_help_request(self, user_id: str) -> Tuple[str, None]:
        """Handle help request"""
        help_text = """
        I can help you with these voice commands:

        • "Create a workflow to deploy a web server" - Create new workflows
        • "Run the backup workflow" - Execute existing workflows
        • "What's the status of my deployment" - Check workflow status
        • "List my workflows" - Show all your workflows
        • "Generate terraform code for AWS infrastructure" - Generate infrastructure code
        • "Deploy the web app to production" - Deploy infrastructure
        • "Monitor the database servers" - Check system health

        Just speak naturally and I'll understand what you want to do!
        """
        return help_text.strip(), None

    def _handle_unknown_command(self, original_text: str) -> Tuple[str, None]:
        """Handle unknown commands"""
        response = f"I didn't understand '{original_text}'. Try saying something like 'create a workflow to deploy a web server' or 'help' to see what I can do."
        return response, None

    async def _generate_audio_response(self, text: str) -> Optional[bytes]:
        """Generate audio response from text"""
        if not self.tts_engine:
            return None

        try:
            # Create temporary file for audio output
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file_path = temp_file.name

            # Generate speech
            def speak_to_file():
                self.tts_engine.save_to_file(text, temp_file_path)
                self.tts_engine.runAndWait()

            # Run TTS in thread to avoid blocking
            thread = threading.Thread(target=speak_to_file)
            thread.start()
            thread.join(timeout=10)  # 10 second timeout

            if thread.is_alive():
                logger.warning("TTS generation timed out")
                return None

            # Read generated audio file
            try:
                with open(temp_file_path, 'rb') as audio_file:
                    audio_data = audio_file.read()
                return audio_data
            finally:
                os.unlink(temp_file_path)

        except Exception as e:
            logger.error(f"Audio generation failed: {e}")
            return None

    async def start_voice_session(self, user_id: str, mode: VoiceMode = VoiceMode.CONVERSATION) -> str:
        """Start a new voice interaction session"""
        session_id = f"voice_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{user_id}"

        session = VoiceSession(
            session_id=session_id,
            user_id=user_id,
            mode=mode,
            context={},
            created_at=datetime.now(),
            last_activity=datetime.now(),
            conversation_history=[]
        )

        self.active_sessions[session_id] = session
        logger.info(f"Started voice session {session_id} for user {user_id}")

        return session_id

    async def end_voice_session(self, session_id: str):
        """End a voice interaction session"""
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]
            logger.info(f"Ended voice session {session_id}")

    async def _update_session_context(self, session_id: str, user_input: str, command_type: VoiceCommand):
        """Update session context for conversation mode"""
        if session_id and session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.last_activity = datetime.now()
            session.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "user_input": user_input,
                "command_type": command_type.value
            })

            # Keep only last 10 interactions to prevent memory bloat
            if len(session.conversation_history) > 10:
                session.conversation_history = session.conversation_history[-10:]

    async def get_voice_capabilities(self) -> Dict[str, Any]:
        """Get voice control capabilities and status"""
        return {
            "supported_commands": [cmd.value for cmd in VoiceCommand if cmd != VoiceCommand.UNKNOWN],
            "supported_modes": [mode.value for mode in VoiceMode],
            "languages_supported": ["en-US", "en-GB", "es-ES", "fr-FR", "de-DE"],
            "tts_available": self.tts_engine is not None,
            "active_sessions": len(self.active_sessions),
            "microphone_available": self.microphone is not None,
            "example_commands": [
                "Create a workflow to deploy a web server on AWS",
                "Run the database backup workflow",
                "What's the status of my production environment",
                "Generate terraform code for a load balancer",
                "List all my workflows"
            ]
        }


# Service instance
voice_control_service = VoiceControlService()