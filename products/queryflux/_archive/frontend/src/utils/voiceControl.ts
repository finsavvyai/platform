export class VoiceControl {
  private recognition: any;
  private isListening: boolean = false;
  private onResultCallback?: (transcript: string, confidence: number) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        if (this.onResultCallback) {
          this.onResultCallback(transcript, confidence);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error);
        }
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };
    }
  }

  isSupported(): boolean {
    return !!this.recognition;
  }

  start(onResult: (transcript: string, confidence: number) => void, onError?: (error: string) => void) {
    if (!this.recognition) {
      if (onError) onError('Speech recognition not supported');
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.isListening = true;
    this.recognition.start();
  }

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

export const voiceControl = new VoiceControl();

export function parseVoiceCommand(transcript: string): { command: string; params?: any } {
  const lower = transcript.toLowerCase().trim();

  if (lower.includes('create connection') || lower.includes('new connection') || lower.includes('add connection')) {
    return { command: 'create_connection' };
  }

  if (lower.includes('run query') || lower.includes('execute query') || lower.includes('run sql')) {
    return { command: 'run_query' };
  }

  if (lower.includes('show history') || lower.includes('open history')) {
    return { command: 'show_history' };
  }

  if (lower.includes('show settings') || lower.includes('open settings')) {
    return { command: 'show_settings' };
  }

  if (lower.includes('show subscription') || lower.includes('open subscription')) {
    return { command: 'show_subscription' };
  }

  if (lower.includes('show themes') || lower.includes('open themes')) {
    return { command: 'show_themes' };
  }

  if (lower.includes('show extensions') || lower.includes('open extensions')) {
    return { command: 'show_extensions' };
  }

  if (lower.startsWith('select') || lower.startsWith('insert') || lower.startsWith('update') || lower.startsWith('delete')) {
    return { command: 'sql_query', params: { query: transcript } };
  }

  return { command: 'unknown', params: { transcript } };
}
