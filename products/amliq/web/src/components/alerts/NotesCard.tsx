import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface NotesCardProps {
  notes: string;
  onNotesChange: (notes: string) => void;
}

const SR: (new () => any) | undefined =
  (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export function NotesCard({ notes, onNotesChange }: NotesCardProps) {
  const { t, i18n } = useTranslation('alerts');
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Ref keeps latest notes value accessible inside onresult without stale closure
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Stop recognition and release mic on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleDictation = () => {
    if (!SR) return;

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = i18n.language;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join(' ');
      const current = notesRef.current;
      onNotesChange(current ? `${current} ${transcript}` : transcript);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  return (
    <Card>
      <h3 className="sf-headline mb-lg">{t('notes.title')}</h3>
      <div className="relative mb-md">
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          aria-label={t('notes.title')}
          className="input-field w-full h-24 pr-10"
          placeholder={t('notes.placeholder')}
        />
        {SR && (
          <button
            type="button"
            onClick={toggleDictation}
            aria-label={recording ? 'Stop dictation' : 'Start dictation'}
            className={`absolute right-2 top-2 p-1.5 rounded-full transition-colors ${
              recording
                ? 'text-apple-red bg-apple-red/10 animate-pulse'
                : 'text-apple-label-secondary hover:text-[var(--dash-text)] hover:bg-[var(--dash-surface)]'
            }`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>
      <Button variant="primary" size="sm">
        {t('notes.save')}
      </Button>
    </Card>
  );
}
