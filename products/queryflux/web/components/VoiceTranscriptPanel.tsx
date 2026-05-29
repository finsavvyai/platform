/**
 * Voice Transcript + Last Result + Commands Panel
 */

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { VoiceCommandResult } from '../hooks/useVoiceRecognition';

interface VoiceTranscriptPanelProps {
  transcript: string;
  interimTranscript: string;
  lastResult: VoiceCommandResult | null;
}

export function VoiceTranscriptPanel({ transcript, interimTranscript, lastResult }: VoiceTranscriptPanelProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <>
      {/* Transcript Display */}
      <div
        className="mb-4 rounded-lg p-3"
        style={{ backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`, minHeight: '120px' }}
      >
        {transcript || interimTranscript ? (
          <div>
            {transcript && (
              <p className="mb-2 text-sm" style={{ color: theme.colors.text }}>{transcript}</p>
            )}
            {interimTranscript && (
              <p className="text-sm italic opacity-70" style={{ color: theme.colors.textSecondary }}>{interimTranscript}</p>
            )}
          </div>
        ) : (
          <p className="text-center text-sm italic" style={{ color: theme.colors.textSecondary }}>
            {t('voice.listeningPrompt')}
          </p>
        )}
      </div>

      {/* Last Result */}
      {lastResult && (
        <div
          className="rounded-lg p-3"
          style={{
            backgroundColor: lastResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${lastResult.success ? '#22c55e' : '#ef4444'}`,
          }}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-bold uppercase" style={{ color: lastResult.success ? '#22c55e' : '#ef4444' }}>
              {lastResult.intent.intent}
            </span>
            <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
              {Math.round(lastResult.intent.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm" style={{ color: theme.colors.text }}>{lastResult.response}</p>
        </div>
      )}

      {/* Supported Commands */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase" style={{ color: theme.colors.textSecondary }}>
          {t('voice.trySaying')}
        </p>
        <ul className="space-y-1">
          {[
            t('voice.commands.executeQuery'),
            t('voice.commands.testConnection'),
            t('voice.commands.showMetrics'),
            t('voice.commands.createAlert'),
          ].map((command, index) => (
            <li key={index} className="rounded px-2 py-1 text-xs" style={{ color: theme.colors.textSecondary }}>
              "{command}"
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
