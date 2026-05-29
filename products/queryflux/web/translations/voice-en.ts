/**
 * Voice Recognition Translations (English)
 *
 * Add these to your main translation file (src/translations/en.ts)
 */

export const voiceTranslations = {
  voice: {
    assistant: 'Voice Assistant',
    startListening: 'Start Listening',
    stopListening: 'Stop Listening',
    clear: 'Clear',
    listeningPrompt: 'Tap the microphone and start speaking...',
    trySaying: 'Try saying:',
    commands: {
      executeQuery: 'Execute SELECT * FROM users',
      testConnection: 'Test the production connection',
      showMetrics: 'Show database metrics',
      createAlert: 'Create an alert for high CPU usage',
    },
    status: {
      listening: 'Listening...',
      processing: 'Processing...',
      error: 'Voice recognition error',
      notSupported: 'Voice recognition is not supported in this browser',
    },
  },
};
