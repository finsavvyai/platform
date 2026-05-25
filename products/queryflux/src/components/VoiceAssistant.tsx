/**
 * Voice Assistant Component
 *
 * Provides voice command interface for QueryFlux
 */

import { useEffect, useState } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { VoiceFeedback } from './VoiceFeedback';
import { VoiceTranscriptPanel } from './VoiceTranscriptPanel';

// ============================================================================
// Types
// ============================================================================

interface VoiceAssistantProps {
  onCommandExecuted?: (result: any) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Main Voice Assistant Component
// ============================================================================

export function VoiceAssistant({ onCommandExecuted, onError }: VoiceAssistantProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    lastResult,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceRecognition({
    language: 'en-US',
    continuous: true,
    interimResults: true,
  });

  // Handle command execution result
  useEffect(() => {
    if (lastResult) {
      if (lastResult.success) {
        setFeedback({
          message: lastResult.response || 'Command executed successfully',
          type: 'success',
        });
        onCommandExecuted?.(lastResult);
      } else {
        setFeedback({
          message: lastResult.error || 'Command execution failed',
          type: 'error',
        });
      }

      // Auto-hide feedback after 3 seconds
      setTimeout(() => setFeedback(null), 3000);
    }
  }, [lastResult, onCommandExecuted]);

  // Handle errors
  useEffect(() => {
    if (error) {
      setFeedback({
        message: error.message,
        type: 'error',
      });
      onError?.(error);
      setTimeout(() => setFeedback(null), 3000);
    }
  }, [error, onError]);

  // Toggle voice assistant
  const toggleVoiceAssistant = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      resetTranscript();
    }
  };

  // Start/stop listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Clear feedback
  const clearFeedback = () => {
    setFeedback(null);
  };

  // Don't render if not supported
  if (!isSupported) {
    return null;
  }

  return (
    <>
      {/* Voice Assistant Button */}
      <button
        onClick={toggleVoiceAssistant}
        className="fixed bottom-6 right-6 z-40 rounded-full p-4 shadow-lg transition-all hover:scale-110"
        style={{
          backgroundColor: theme.colors.accent,
          color: 'white',
        }}
        title="Voice Assistant"
      >
        {isOpen ? <X size={24} /> : <Mic size={24} />}
      </button>

      {/* Voice Assistant Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-40 w-96 rounded-lg shadow-xl"
          style={{
            backgroundColor: theme.colors.sidebar,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center gap-2">
              <Mic size={20} style={{ color: theme.colors.accent }} />
              <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                {t('voice.assistant')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Listening Indicator */}
              {isListening && (
                <div className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Controls */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={toggleListening}
                disabled={!isSupported}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all ${
                  isListening
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                } ${!isSupported ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                {isListening ? t('voice.stopListening') : t('voice.startListening')}
              </button>

              <button
                onClick={resetTranscript}
                className="rounded-lg px-4 py-2 text-sm transition-all hover:bg-gray-700"
                style={{ color: theme.colors.text }}
              >
                {t('voice.clear')}
              </button>
            </div>

            <VoiceTranscriptPanel
              transcript={transcript}
              interimTranscript={interimTranscript}
              lastResult={lastResult}
            />
          </div>
        </div>
      )}

      {/* Feedback Toast */}
      {feedback && (
        <VoiceFeedback
          message={feedback.message}
          type={feedback.type}
          onClose={clearFeedback}
        />
      )}
    </>
  );
}
