/**
 * Voice Recognition Hook
 *
 * Provides voice recognition capabilities using Web Speech API
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '../lib/enhanced-api-client';

// Types exported from ./voiceTypes
import type { VoiceConfig, VoiceIntent, VoiceCommandResult, UseVoiceRecognitionReturn } from './voiceTypes';
export type { VoiceConfig, VoiceIntent, VoiceCommandResult, UseVoiceRecognitionReturn } from './voiceTypes';

export function useVoiceRecognition(config: Partial<VoiceConfig> = {}): UseVoiceRecognitionReturn {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
  } = config;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [intents, setIntents] = useState<VoiceIntent[]>([]);
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(SpeechRecognition !== undefined);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalTranscriptText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscriptText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalTranscriptText) {
        setTranscript((prev) => prev + finalTranscriptText);
        setInterimTranscript('');

        // Process voice command
        processVoiceCommand(finalTranscriptText);
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const error = new Error(`Speech recognition error: ${event.error}`);
      setError(error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, continuous, interimResults, maxAlternatives, isSupported]);

  // Process voice command through backend
  const processVoiceCommand = useCallback(async (transcriptText: string) => {
    try {
      if (!sessionIdRef.current) {
        // Start voice session
        const response = await apiClient.voice.startSession({ language });
        sessionIdRef.current = response.sessionId;
      }

      // Process transcript
      const result = await apiClient.voice.processTranscript({
        sessionId: sessionIdRef.current,
        transcript: transcriptText,
        language,
      });

      setLastResult(result);
      setIntents((prev) => [...prev, result.intent]);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process voice command');
      setError(error);
      throw error;
    }
  }, [language]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError(new Error('Speech recognition is not supported in this browser'));
      return;
    }

    if (!recognitionRef.current) {
      setError(new Error('Speech recognition not initialized'));
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (err) {
      // Already started
      setError(err instanceof Error ? err : new Error('Failed to start listening'));
    }
  }, [isSupported]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // End voice session
    if (sessionIdRef.current) {
      apiClient.voice.endSession({ sessionId: sessionIdRef.current })
        .catch((err) => console.error('Failed to end voice session:', err));
      sessionIdRef.current = null;
    }
  }, []);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setIntents([]);
    setLastResult(null);
    setError(null);
  }, []);

  // Execute voice command manually
  const executeVoiceCommand = useCallback(async (transcriptText: string): Promise<VoiceCommandResult> => {
    return processVoiceCommand(transcriptText);
  }, [processVoiceCommand]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current) {
        apiClient.voice.endSession({ sessionId: sessionIdRef.current })
          .catch((err) => console.error('Failed to end voice session:', err));
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    intents,
    lastResult,
    error,
    startListening,
    stopListening,
    resetTranscript,
    executeVoiceCommand,
  };
}
