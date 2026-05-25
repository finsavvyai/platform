import { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { voiceControl, parseVoiceCommand } from '../utils/voiceControl';

interface VoiceCommandButtonProps {
  onCommand: (command: string, params?: any) => void;
}

export function VoiceCommandButton({ onCommand }: VoiceCommandButtonProps) {
  const { theme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    if (!voiceControl.isSupported()) {
      return;
    }

    const checkListening = setInterval(() => {
      setIsListening(voiceControl.getIsListening());
    }, 100);

    return () => clearInterval(checkListening);
  }, []);

  const handleVoiceCommand = () => {
    if (!voiceControl.isSupported()) {
      alert('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      voiceControl.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      setIsListening(true);
      voiceControl.start(
        (text, confidence) => {
          setTranscript(text);
          setIsListening(false);

          const { command, params } = parseVoiceCommand(text);
          onCommand(command, params);

          setTimeout(() => setTranscript(''), 3000);
        },
        (error) => {
          console.error('Voice error:', error);
          setIsListening(false);
          setTranscript('');
        }
      );
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleVoiceCommand}
        className={`p-2.5 rounded-lg transition-all hover-3d ${
          isListening ? 'animate-pulse glow-effect' : 'glass-morphism'
        }`}
        style={{
          backgroundColor: isListening ? theme.colors.accent : 'transparent',
        }}
        title="Voice Commands"
      >
        {isListening ? (
          <MicOff className="w-5 h-5 text-white" />
        ) : (
          <Mic className="w-5 h-5" style={{ color: theme.colors.accent }} />
        )}
      </button>

      {(isListening || transcript) && (
        <div
          className="absolute top-full right-0 mt-2 px-3 py-2 rounded-lg glass-card border text-xs whitespace-nowrap shadow-lg z-50"
          style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}
        >
          {isListening ? (
            <div className="flex items-center gap-2" style={{ color: theme.colors.accent }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.colors.accent }} />
              Listening...
            </div>
          ) : (
            <p style={{ color: theme.colors.text }}>"{transcript}"</p>
          )}
        </div>
      )}
    </div>
  );
}
