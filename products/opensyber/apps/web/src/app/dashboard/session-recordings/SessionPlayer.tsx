'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Play, Pause, AlertTriangle, Flag, SkipForward } from 'lucide-react';
import type { SessionRecording, SessionCommand } from './types';

interface SessionPlayerProps {
  session: SessionRecording;
  onClose: () => void;
}

const speeds = [1, 2, 4] as const;

function CommandLine({ cmd, active }: { cmd: SessionCommand; active: boolean }): React.ReactElement {
  return (
    <div
      className={`px-3 py-2 rounded-lg text-xs font-mono transition-all ${
        active ? 'bg-neutral-800 ring-1 ring-info/50' : ''
      } ${cmd.dangerous ? 'bg-red-500/10 border-l-2 border-red-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-neutral-500 shrink-0">{cmd.timestamp}</span>
        {cmd.dangerous && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
        <span className={cmd.dangerous ? 'text-red-300' : 'text-green-300'}>$ {cmd.command}</span>
      </div>
      {cmd.output && <div className="mt-1 text-neutral-400 pl-16">{cmd.output}</div>}
    </div>
  );
}

export function SessionPlayer({ session, onClose }: SessionPlayerProps): React.ReactElement {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const commands = session.commands;

  const advance = useCallback(() => {
    setCurrentIdx((prev) => {
      if (prev >= commands.length - 1) {
        setPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [commands.length]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(advance, 1500 / speed);
    return () => clearInterval(interval);
  }, [playing, speed, advance]);

  const dangerousIdxs = commands
    .map((c, i) => (c.dangerous ? i : -1))
    .filter((i) => i >= 0);

  const jumpToNextFlagged = (): void => {
    const next = dangerousIdxs.find((i) => i > currentIdx);
    if (next !== undefined) {
      setCurrentIdx(next);
      setPlaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-label="Session player">
      <div className="w-full max-w-4xl max-h-[80vh] rounded-xl border border-neutral-800 bg-neutral-900 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 p-4">
          <div>
            <h3 className="text-lg font-medium">{session.user} - {session.target}</h3>
            <p className="text-xs text-neutral-400">{session.sessionType} session - {session.duration}m</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-neutral-800 transition" aria-label="Close player">
            <X className="h-5 w-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Timeline sidebar */}
          <div className="w-64 border-r border-neutral-800 overflow-y-auto p-3 space-y-1 shrink-0">
            <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 px-1">Command Timeline</p>
            {commands.map((cmd, i) => (
              <button
                key={i}
                onClick={() => { setCurrentIdx(i); setPlaying(false); }}
                className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition ${
                  i === currentIdx ? 'bg-info/20 text-info' : 'text-neutral-400 hover:bg-neutral-800'
                } ${cmd.dangerous ? 'text-red-400' : ''}`}
              >
                <span className="text-neutral-500 mr-2">{cmd.timestamp}</span>
                <span className="truncate">{cmd.command.slice(0, 24)}</span>
              </button>
            ))}
          </div>

          {/* Terminal */}
          <div className="flex-1 overflow-y-auto bg-neutral-950 p-4 space-y-1">
            {commands.slice(0, currentIdx + 1).map((cmd, i) => (
              <CommandLine key={i} cmd={cmd} active={i === currentIdx} />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between border-t border-neutral-800 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaying(!playing)}
              className="rounded-lg bg-info p-2 hover:bg-info transition"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-1">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    speed === s ? 'bg-info text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
            {dangerousIdxs.length > 0 && (
              <button
                onClick={jumpToNextFlagged}
                className="flex items-center gap-1.5 rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                <SkipForward className="h-3 w-3" /> Jump to flagged
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">
              {currentIdx + 1} / {commands.length} commands
            </span>
            <button className="flex items-center gap-1.5 rounded-lg border border-amber-800 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-500/10 transition">
              <Flag className="h-3 w-3" /> Flag for Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
