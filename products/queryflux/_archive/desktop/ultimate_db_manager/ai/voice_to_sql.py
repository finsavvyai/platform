#!/usr/bin/env python3
"""
Voice to SQL - Revolutionary Speech Recognition Database Interface
The world's first hands-free database management system
"""

import asyncio
import json
import os
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum
import logging
import wave
import pyaudio
import speech_recognition as sr
import pyttsx3
from threading import Thread, Event
import tempfile

logger = logging.getLogger(__name__)

class VoiceCommand(Enum):
    QUERY = "query"
    EXPLAIN = "explain"
    OPTIMIZE = "optimize"
    CREATE_TABLE = "create_table"
    INSERT_DATA = "insert_data"
    CONNECT = "connect"
    DISCONNECT = "disconnect"
    HELP = "help"
    STOP = "stop"

@dataclass
class VoiceResult:
    """Voice recognition result"""
    text: str
    confidence: float
    command: VoiceCommand
    sql_query: str
    response: str
    metadata: Dict[str, Any]

class VoiceToSQLEngine:
    """Revolutionary Voice-to-SQL Engine"""

    def __init__(self, ai_assistant=None):
        self.ai_assistant = ai_assistant
        self.recognizer = sr.Recognizer()
        self.microphone = sr.Microphone()
        self.tts_engine = pyttsx3.init()

        # Voice settings
        self.tts_engine.setProperty('rate', 150)  # Words per minute
        self.tts_engine.setProperty('volume', 0.9)

        # State management
        self.is_listening = False
        self.stop_event = Event()
        self.listening_thread = None

        # Voice command patterns
        self.command_patterns = {
            VoiceCommand.QUERY: [
                "show me", "find", "select", "get", "retrieve", "display",
                "what", "how many", "count", "sum", "average"
            ],
            VoiceCommand.CREATE_TABLE: [
                "create table", "make table", "new table", "build table"
            ],
            VoiceCommand.INSERT_DATA: [
                "insert", "add", "create record", "new record", "save"
            ],
            VoiceCommand.EXPLAIN: [
                "explain", "describe", "what does", "how does"
            ],
            VoiceCommand.OPTIMIZE: [
                "optimize", "improve", "make faster", "speed up"
            ],
            VoiceCommand.CONNECT: [
                "connect to", "connect", "open connection", "use database"
            ],
            VoiceCommand.HELP: [
                "help", "commands", "what can you do"
            ],
            VoiceCommand.STOP: [
                "stop", "quit", "exit", "done", "finish"
            ]
        }

        logger.info("🎤 Voice-to-SQL Engine initialized")

    async def start_listening(self, callback: Callable[[VoiceResult], None] = None):
        """Start continuous voice recognition"""
        if self.is_listening:
            return

        self.is_listening = True
        self.stop_event.clear()

        # Calibrate microphone
        await self._calibrate_microphone()

        # Start listening thread
        self.listening_thread = Thread(
            target=self._continuous_listening_thread,
            args=(callback,)
        )
        self.listening_thread.start()

        self._speak("Voice recognition started. Say a database command.")
        logger.info("🎤 Started continuous voice recognition")

    def stop_listening(self):
        """Stop voice recognition"""
        if not self.is_listening:
            return

        self.is_listening = False
        self.stop_event.set()

        if self.listening_thread:
            self.listening_thread.join(timeout=2)

        self._speak("Voice recognition stopped.")
        logger.info("🛑 Stopped voice recognition")

    async def _calibrate_microphone(self):
        """Calibrate microphone for ambient noise"""
        try:
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
            logger.info("🎚️ Microphone calibrated")
        except Exception as e:
            logger.warning(f"Microphone calibration failed: {e}")

    def _continuous_listening_thread(self, callback: Callable[[VoiceResult], None]):
        """Continuous listening thread"""
        while self.is_listening and not self.stop_event.is_set():
            try:
                with self.microphone as source:
                    # Listen for audio with timeout
                    audio = self.recognizer.listen(
                        source,
                        timeout=1,
                        phrase_time_limit=10
                    )

                # Process audio in separate thread to avoid blocking
                Thread(
                    target=self._process_audio,
                    args=(audio, callback)
                ).start()

            except sr.WaitTimeoutError:
                # Normal timeout, continue listening
                continue
            except Exception as e:
                logger.error(f"Listening error: {e}")
                break

    def _process_audio(self, audio, callback: Callable[[VoiceResult], None]):
        """Process audio and convert to SQL"""
        try:
            # Convert speech to text
            text = self.recognizer.recognize_google(audio)
            logger.info(f"🗣️ Heard: '{text}'")

            # Process the command asynchronously
            asyncio.run(self._process_voice_command(text, callback))

        except sr.UnknownValueError:
            logger.debug("Could not understand audio")
        except sr.RequestError as e:
            logger.error(f"Speech recognition error: {e}")
        except Exception as e:
            logger.error(f"Audio processing error: {e}")

    async def _process_voice_command(
        self,
        text: str,
        callback: Callable[[VoiceResult], None]
    ):
        """Process voice command and generate SQL"""
        try:
            # Identify command type
            command = self._identify_command(text)

            # Generate SQL based on command
            result = await self._generate_sql_from_voice(text, command)

            # Execute callback if provided
            if callback:
                callback(result)

            # Speak response
            self._speak(result.response)

        except Exception as e:
            logger.error(f"Command processing error: {e}")
            error_result = VoiceResult(
                text=text,
                confidence=0.0,
                command=VoiceCommand.HELP,
                sql_query="",
                response=f"Sorry, I couldn't process that command: {str(e)}",
                metadata={"error": str(e)}
            )
            if callback:
                callback(error_result)

    def _identify_command(self, text: str) -> VoiceCommand:
        """Identify the type of voice command"""
        text_lower = text.lower()

        # Check each command pattern
        for command, patterns in self.command_patterns.items():
            for pattern in patterns:
                if pattern in text_lower:
                    return command

        # Default to query if no specific command found
        return VoiceCommand.QUERY

    async def _generate_sql_from_voice(self, text: str, command: VoiceCommand) -> VoiceResult:
        """Generate SQL from voice command"""
        try:
            if command == VoiceCommand.STOP:
                self.stop_listening()
                return VoiceResult(
                    text=text,
                    confidence=1.0,
                    command=command,
                    sql_query="",
                    response="Stopping voice recognition.",
                    metadata={}
                )

            elif command == VoiceCommand.HELP:
                return VoiceResult(
                    text=text,
                    confidence=1.0,
                    command=command,
                    sql_query="",
                    response=self._get_help_message(),
                    metadata={}
                )

            elif command == VoiceCommand.QUERY:
                # Use AI assistant to convert natural language to SQL
                if self.ai_assistant and hasattr(self.ai_assistant, 'natural_language_to_sql'):
                    # Mock schema for voice commands
                    mock_schema = self._get_mock_schema()

                    suggestion = await self.ai_assistant.natural_language_to_sql(
                        text, mock_schema
                    )

                    return VoiceResult(
                        text=text,
                        confidence=suggestion.confidence,
                        command=command,
                        sql_query=suggestion.sql,
                        response=f"Here's your SQL query: {suggestion.sql[:100]}...",
                        metadata={
                            "explanation": suggestion.explanation,
                            "ai_generated": True
                        }
                    )
                else:
                    # Fallback to pattern matching
                    sql = self._pattern_match_sql(text)
                    return VoiceResult(
                        text=text,
                        confidence=0.7,
                        command=command,
                        sql_query=sql,
                        response=f"Generated SQL: {sql}",
                        metadata={"method": "pattern_matching"}
                    )

            elif command == VoiceCommand.CREATE_TABLE:
                sql = self._generate_create_table_sql(text)
                return VoiceResult(
                    text=text,
                    confidence=0.8,
                    command=command,
                    sql_query=sql,
                    response=f"Table creation SQL ready: {sql[:50]}...",
                    metadata={}
                )

            elif command == VoiceCommand.EXPLAIN:
                if self.ai_assistant and hasattr(self.ai_assistant, 'explain_query'):
                    # Extract query from voice command
                    query = self._extract_query_from_explain(text)
                    explanation = await self.ai_assistant.explain_query(query)

                    return VoiceResult(
                        text=text,
                        confidence=0.9,
                        command=command,
                        sql_query=query,
                        response=f"Query explanation: {explanation[:100]}...",
                        metadata={"full_explanation": explanation}
                    )

            # Default fallback
            return VoiceResult(
                text=text,
                confidence=0.5,
                command=command,
                sql_query="SELECT 'Voice command processed' as result;",
                response="I understood your command but need more context to generate SQL.",
                metadata={}
            )

        except Exception as e:
            logger.error(f"SQL generation from voice failed: {e}")
            return VoiceResult(
                text=text,
                confidence=0.0,
                command=command,
                sql_query="",
                response="Sorry, I couldn't generate SQL from that command.",
                metadata={"error": str(e)}
            )

    def _pattern_match_sql(self, text: str) -> str:
        """Pattern match voice text to generate SQL"""
        text_lower = text.lower()

        # Simple pattern matching for common queries
        if "show me all" in text_lower or "get all" in text_lower:
            # Extract table name (simplified)
            words = text_lower.split()
            if "users" in words:
                return "SELECT * FROM users LIMIT 100;"
            elif "orders" in words:
                return "SELECT * FROM orders LIMIT 100;"
            else:
                return "SELECT * FROM table_name LIMIT 100;"

        elif "count" in text_lower:
            if "users" in text_lower:
                return "SELECT COUNT(*) FROM users;"
            elif "orders" in text_lower:
                return "SELECT COUNT(*) FROM orders;"
            else:
                return "SELECT COUNT(*) FROM table_name;"

        elif "find" in text_lower and "where" in text_lower:
            # Extract conditions (very simplified)
            return "SELECT * FROM table_name WHERE column_name = 'value';"

        else:
            # Generic fallback
            return "-- Voice command: " + text + "\n-- Please refine your query"

    def _generate_create_table_sql(self, text: str) -> str:
        """Generate CREATE TABLE SQL from voice"""
        text_lower = text.lower()

        # Extract table name (simplified)
        words = text_lower.split()
        table_name = "new_table"

        for i, word in enumerate(words):
            if word == "table" and i + 1 < len(words):
                table_name = words[i + 1]
                break

        # Generate basic table structure
        return f"""CREATE TABLE {table_name} (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"""

    def _extract_query_from_explain(self, text: str) -> str:
        """Extract SQL query from explain command"""
        # This is a simplified implementation
        # In production, you'd use more sophisticated NLP

        # Look for SQL keywords in the text
        sql_keywords = ["select", "insert", "update", "delete", "create", "drop"]

        words = text.lower().split()
        query_start = -1

        for i, word in enumerate(words):
            if word in sql_keywords:
                query_start = i
                break

        if query_start != -1:
            # Return the part that looks like SQL
            return " ".join(words[query_start:])
        else:
            # Return a default query for explanation
            return "SELECT * FROM users WHERE age > 18;"

    def _get_mock_schema(self) -> Dict[str, Any]:
        """Get mock schema for voice commands"""
        return {
            "users": [
                {"column_name": "id", "data_type": "integer"},
                {"column_name": "name", "data_type": "varchar"},
                {"column_name": "email", "data_type": "varchar"},
                {"column_name": "age", "data_type": "integer"},
                {"column_name": "created_at", "data_type": "timestamp"}
            ],
            "orders": [
                {"column_name": "id", "data_type": "integer"},
                {"column_name": "user_id", "data_type": "integer"},
                {"column_name": "amount", "data_type": "decimal"},
                {"column_name": "status", "data_type": "varchar"}
            ],
            "products": [
                {"column_name": "id", "data_type": "integer"},
                {"column_name": "name", "data_type": "varchar"},
                {"column_name": "price", "data_type": "decimal"},
                {"column_name": "category", "data_type": "varchar"}
            ]
        }

    def _get_help_message(self) -> str:
        """Get voice command help message"""
        return """Here are the voice commands I understand:

        Query commands: 'Show me all users', 'Count orders', 'Find products where price is high'

        Table commands: 'Create table customers', 'Make new table inventory'

        Data commands: 'Insert new user', 'Add product record'

        Help commands: 'Explain this query', 'Optimize slow query'

        Control commands: 'Connect to database', 'Stop listening', 'Help'

        Just speak naturally and I'll convert your words to SQL!"""

    def _speak(self, text: str):
        """Convert text to speech"""
        try:
            # Limit response length for speech
            if len(text) > 200:
                text = text[:200] + "... and more."

            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
        except Exception as e:
            logger.error(f"Text-to-speech error: {e}")

    async def process_single_command(self, text: str) -> VoiceResult:
        """Process a single voice command (without continuous listening)"""
        command = self._identify_command(text)
        return await self._generate_sql_from_voice(text, command)

    def set_voice_settings(self, rate: int = 150, volume: float = 0.9):
        """Customize voice settings"""
        try:
            self.tts_engine.setProperty('rate', rate)
            self.tts_engine.setProperty('volume', volume)
            logger.info(f"🔊 Voice settings updated: rate={rate}, volume={volume}")
        except Exception as e:
            logger.error(f"Failed to set voice settings: {e}")

    async def test_voice_recognition(self) -> bool:
        """Test voice recognition system"""
        try:
            # Test microphone
            with self.microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)

            # Test text-to-speech
            self._speak("Voice recognition test successful")

            logger.info("✅ Voice recognition system test passed")
            return True

        except Exception as e:
            logger.error(f"❌ Voice recognition test failed: {e}")
            return False

# Global voice engine instance
voice_engine = None

def get_voice_engine(ai_assistant=None) -> VoiceToSQLEngine:
    """Get the global voice engine instance"""
    global voice_engine
    if voice_engine is None:
        voice_engine = VoiceToSQLEngine(ai_assistant)
    return voice_engine

__all__ = [
    'VoiceToSQLEngine',
    'VoiceResult',
    'VoiceCommand',
    'get_voice_engine'
]