import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Settings, X, Shield, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Connection } from '../lib/supabase';
import { generateEnhancedAIResponse } from './EnhancedAIResponse';

interface AIAssistantProps {
  connection: Connection;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIAssistant({ connection, isOpen, onClose }: AIAssistantProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI database assistant. I can help you with:\n\n• Writing and optimizing SQL queries\n• Security analysis\n• Performance recommendations\n• Index suggestions\n• Query explanations\n\nWhat would you like to know about your ${connection.database_type} database?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const aiResponse: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: generateEnhancedAIResponse(input),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiResponse]);
    setIsLoading(false);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 glass-morphism-strong border-l shimmer z-50 flex flex-col" style={{ borderColor: theme.colors.border }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center glow-effect">
            <Bot className="w-5 h-5" style={{ color: theme.colors.accent }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>AI Assistant</h3>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg glass-morphism hover-3d transition-all"
          >
            <Settings className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg glass-morphism hover-3d transition-all"
          >
            <X className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="p-4 glass-card border-b" style={{ borderColor: theme.colors.border }}>
          <h4 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>AI Settings</h4>
          <div className="space-y-2 text-xs" style={{ color: theme.colors.textSecondary }}>
            <p>Provider: OpenAI (GPT-4)</p>
            <p>Model: gpt-4-turbo-preview</p>
            <button className="text-xs px-3 py-1.5 rounded-lg hover-3d" style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
              Configure Providers
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 glow-effect ${
              message.role === 'assistant' ? 'glass-morphism' : ''
            }`} style={{
              backgroundColor: message.role === 'user' ? theme.colors.accent + '40' : undefined
            }}>
              {message.role === 'assistant' ? (
                <Sparkles className="w-4 h-4" style={{ color: theme.colors.accent }} />
              ) : (
                <span className="text-sm font-semibold" style={{ color: 'white' }}>U</span>
              )}
            </div>
            <div className={`flex-1 ${message.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block p-3 rounded-xl text-sm glass-card ${
                message.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'
              }`} style={{
                color: theme.colors.text,
                borderColor: message.role === 'user' ? theme.colors.accent : theme.colors.border,
                borderWidth: '1px'
              }}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center glow-effect">
              <Sparkles className="w-4 h-4 animate-pulse" style={{ color: theme.colors.accent }} />
            </div>
            <div className="flex-1">
              <div className="inline-block p-3 rounded-xl rounded-tl-none text-sm glass-card">
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.colors.accent }} />
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.colors.accent, animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.colors.accent, animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t glass-morphism-strong" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-2 mb-2">
          <button className="px-3 py-1.5 text-xs rounded-lg glass-morphism hover-3d flex items-center gap-1" style={{ color: theme.colors.textSecondary }}>
            <Shield className="w-3 h-3" />
            Security
          </button>
          <button className="px-3 py-1.5 text-xs rounded-lg glass-morphism hover-3d flex items-center gap-1" style={{ color: theme.colors.textSecondary }}>
            <Zap className="w-3 h-3" />
            Performance
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about your database..."
            className="flex-1 px-4 py-2.5 rounded-xl glass-card border outline-none text-sm"
            style={{
              color: theme.colors.text,
              borderColor: theme.colors.border
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl font-semibold hover-3d glow-effect disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`, color: 'white' }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
