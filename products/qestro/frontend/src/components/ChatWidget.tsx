import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';
import { chatWidgetStyles } from './ChatWidget.styles';

type ChatRole = 'user' | 'assistant';
interface ChatMsg { role: ChatRole; content: string; }

const GREETING: ChatMsg = {
    role: 'assistant',
    content:
        "Hi! I'm Qestro's AI copilot. Paste a URL or describe what you want to test, and I'll help you generate tests.",
};

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '';

async function postChat(messages: ChatMsg[]): Promise<string> {
    const token = localStorage.getItem('access_token') || '';
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const body = await res.json();
    const reply = body?.data?.reply;
    if (typeof reply !== 'string' || !reply) {
        throw new Error('Empty reply');
    }
    return reply;
}

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
    const [busy, setBusy] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, busy]);

    const send = async () => {
        const text = input.trim();
        if (!text || busy) return;
        const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
        setMessages(next);
        setInput('');
        setBusy(true);
        try {
            const reply = await postChat(next);
            setMessages((m) => [...m, { role: 'assistant', content: reply }]);
        } catch {
            setMessages((m) => [
                ...m,
                { role: 'assistant', content: 'Sorry, I hit an error. Try again?' },
            ]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            {!isOpen && (
                <button className="chat-bubble" onClick={() => setIsOpen(true)} aria-label="Open chat">
                    <MessageCircle size={24} />
                </button>
            )}

            {isOpen && (
                <div className={`chat-window ${isMinimized ? 'minimized' : ''}`} data-testid="chat-widget">
                    <div className="chat-header">
                        <div className="chat-header-info">
                            <div className="avatar-chat">Q</div>
                            <div>
                                <div className="chat-title">Qestro AI Copilot</div>
                                <div className="chat-status">● Online</div>
                            </div>
                        </div>
                        <div className="chat-actions">
                            <button className="chat-btn" aria-label="Minimize" onClick={() => setIsMinimized(!isMinimized)}>
                                <Minimize2 size={16} />
                            </button>
                            <button className="chat-btn" aria-label="Close" onClick={() => setIsOpen(false)}>
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {!isMinimized && (
                        <>
                            <div className="chat-body" ref={bodyRef}>
                                {messages.map((m, i) => (
                                    <div key={i} className={`chat-message ${m.role === 'user' ? 'user' : 'bot'}`}>
                                        <div className="message-avatar">{m.role === 'user' ? 'You' : 'Q'}</div>
                                        <div className="message-content">{m.content}</div>
                                    </div>
                                ))}
                                {busy && (
                                    <div className="chat-message bot" data-testid="chat-typing">
                                        <div className="message-avatar">Q</div>
                                        <div className="message-content">
                                            <span className="typing-dots">
                                                <span /><span /><span />
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="chat-footer">
                                <input
                                    type="text"
                                    placeholder="Describe what to test..."
                                    className="chat-input"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void send();
                                        }
                                    }}
                                    disabled={busy}
                                    aria-label="Chat input"
                                />
                                <button
                                    className="send-btn"
                                    disabled={!input.trim() || busy}
                                    onClick={() => void send()}
                                    aria-label="Send message"
                                >
                                    <Send size={16} />
                                </button>
                            </div>

                            <div className="chat-branding">
                                Powered by <strong>Qestro AI</strong>
                            </div>
                        </>
                    )}
                </div>
            )}

            <style>{chatWidgetStyles}</style>
        </>
    );
};

export default ChatWidget;
