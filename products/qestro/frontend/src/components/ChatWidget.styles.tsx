/**
 * ChatWidget styles — extracted so the component stays under 200 lines.
 */
export const chatWidgetStyles = `
  .chat-bubble {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    cursor: pointer;
    transition: all 0.3s;
    z-index: 1000;
  }

  .chat-bubble:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
  }

  .chat-window {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    width: 380px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    max-height: 600px;
    animation: slideUp 0.3s ease-out;
  }

  .chat-window.minimized { max-height: 60px; }

  @media (max-width: 768px) {
    .chat-bubble { left: 1rem; bottom: 1rem; }
    .chat-window {
      left: 1rem; right: 1rem; bottom: 1rem;
      width: auto; max-width: calc(100vw - 2rem);
    }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .chat-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border-radius: 1rem 1rem 0 0;
    color: white;
  }

  .chat-header-info { display: flex; align-items: center; gap: 0.75rem; }

  .avatar-chat {
    width: 40px; height: 40px; border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.2);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 1.125rem;
  }

  .chat-title { font-weight: 600; font-size: 0.875rem; }
  .chat-status { font-size: 0.75rem; opacity: 0.9; }
  .chat-actions { display: flex; gap: 0.5rem; }

  .chat-btn {
    width: 28px; height: 28px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    color: white; transition: background-color 0.2s;
  }
  .chat-btn:hover { background-color: rgba(255, 255, 255, 0.2); }

  .chat-body {
    flex: 1; padding: 1.5rem; overflow-y: auto; max-height: 400px;
  }

  .chat-message { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
  .chat-message.user { flex-direction: row-reverse; }

  .message-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background-color: var(--accent-primary);
    color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem; font-weight: 600; flex-shrink: 0;
  }
  .chat-message.user .message-avatar { background-color: #6366f1; }

  .message-content {
    background-color: var(--bg-tertiary);
    padding: 0.75rem 1rem; border-radius: 0.75rem;
    font-size: 0.875rem; line-height: 1.5;
    white-space: pre-wrap; word-wrap: break-word; max-width: 250px;
  }
  .chat-message.user .message-content {
    background-color: var(--accent-primary); color: white;
  }

  .typing-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
  .typing-dots span {
    width: 6px; height: 6px; border-radius: 50%;
    background-color: var(--text-secondary);
    animation: typingDot 1.2s infinite ease-in-out;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes typingDot {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-3px); }
  }

  .chat-footer {
    padding: 1rem; border-top: 1px solid var(--border-color);
    display: flex; gap: 0.75rem; align-items: center;
  }

  .chat-input {
    flex: 1; background-color: var(--bg-tertiary);
    border: 1px solid var(--border-color); color: var(--text-primary);
    padding: 0.625rem 0.875rem; border-radius: 0.5rem;
    outline: none; font-size: 0.875rem;
  }
  .chat-input:focus { border-color: var(--accent-primary); }

  .send-btn {
    width: 36px; height: 36px; border-radius: 0.5rem;
    background-color: var(--accent-primary); color: white;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.2s;
  }
  .send-btn:hover:not(:disabled) { background-color: var(--accent-primary-hover); }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .chat-branding {
    padding: 0.5rem 1rem; text-align: center;
    font-size: 0.75rem; color: var(--text-secondary);
    border-top: 1px solid var(--border-color);
  }
  .chat-branding strong { color: var(--text-primary); }
`;
