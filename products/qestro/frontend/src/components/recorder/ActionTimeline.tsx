import { Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Action {
  id: string;
  type: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  duration?: number;
}

interface ActionTimelineProps {
  actions: Action[];
  isRecording?: boolean;
  onDeleteAction?: (id: string) => void;
  onEditAction?: (id: string) => void;
}

const ACTION_ICONS: Record<string, string> = {
  click: '🖱️',
  type: '⌨️',
  navigate: '🌐',
  wait: '⏳',
  screenshot: '📸',
};

const ACTION_BG: Record<string, string> = {
  click: 'bg-blue-900/20 border-blue-700',
  type: 'bg-green-900/20 border-green-700',
  navigate: 'bg-purple-900/20 border-purple-700',
  wait: 'bg-orange-900/20 border-orange-700',
  screenshot: 'bg-pink-900/20 border-pink-700',
};

export function ActionTimeline({
  actions,
  isRecording = false,
  onDeleteAction,
  onEditAction,
}: ActionTimelineProps) {
  const getActionLabel = (action: Action): string => {
    switch (action.type) {
      case 'click':
        return `Clicked ${action.selector || 'element'}`;
      case 'type':
        return `Typed "${action.value}" in ${action.selector || 'field'}`;
      case 'navigate':
        return `Navigated to ${action.url}`;
      case 'wait':
        return `Waited ${action.duration || 1}s`;
      case 'screenshot':
        return 'Took screenshot';
      default:
        return 'Unknown action';
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  if (actions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-slate-400 text-sm">
            {isRecording ? 'Start interacting with the page to record actions' : 'No actions recorded yet'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Vertical Timeline */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500" />

        {/* Actions */}
        <AnimatePresence>
          {actions.map((action, idx) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative pl-14 pb-6 ${ACTION_BG[action.type]} border rounded-lg p-3 ml-0`}
            >
              {/* Timeline Dot */}
              <div className="absolute left-0 top-3 w-10 h-10 bg-slate-900 border-2 border-slate-700 rounded-full flex items-center justify-center -translate-x-2">
                <span className="text-lg">{ACTION_ICONS[action.type]}</span>
              </div>

              {/* Action Content */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      {getActionLabel(action)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatTime(action.timestamp)}
                      {action.type === 'wait' && ` (${action.duration || 1}s)`}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  {!isRecording && (
                    <div className="flex gap-1 ml-2">
                      {onEditAction && (
                        <button
                          onClick={() => onEditAction(action.id)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                          title="Edit action"
                        >
                          <Edit2 className="h-3 w-3 text-slate-400 hover:text-slate-200" />
                        </button>
                      )}
                      {onDeleteAction && (
                        <button
                          onClick={() => onDeleteAction(action.id)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                          title="Delete action"
                        >
                          <Trash2 className="h-3 w-3 text-slate-400 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Details */}
                {action.selector && (
                  <p className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded mt-2 break-all">
                    {action.selector}
                  </p>
                )}
                {action.value && (
                  <p className="text-xs text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded mt-2 break-all">
                    Value: "{action.value}"
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Summary */}
      {actions.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-4 border-t border-slate-700 text-xs text-slate-400"
        >
          <p>
            Total duration: <span className="text-slate-300 font-medium">{formatTime(actions[actions.length - 1].timestamp)}</span>
          </p>
          <p>
            Actions recorded: <span className="text-slate-300 font-medium">{actions.length}</span>
          </p>
        </motion.div>
      )}
    </div>
  );
}
