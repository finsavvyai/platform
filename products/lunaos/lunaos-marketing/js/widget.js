/**
 * LunaOS Embeddable Widget
 * Usage:
 * <div id="lunaos-widget" data-agent-id="custom-..." data-api-key="luna-sk-..."></div>
 * <script src="https://lunaos.ai/js/widget.js"></script>
 */

(function () {
    const container = document.getElementById('lunaos-widget');
    if (!container) {
        console.error('LunaOS Widget: Missing <div id="lunaos-widget">');
        return;
    }

    const agentId = container.getAttribute('data-agent-id');
    const apiKey = container.getAttribute('data-api-key');
    const themeColor = container.getAttribute('data-theme-color') || '#8b5cf6'; // default violet-500

    if (!agentId || !apiKey) {
        container.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red; border-radius: 4px;">LunaOS Widget Error: Missing data-agent-id or data-api-key</div>`;
        return;
    }

    // Inject CSS
    const styleId = 'lunaos-widget-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .lunaos-widget-container {
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            .lunaos-widget-toggle {
                width: 60px;
                height: 60px;
                border-radius: 30px;
                background-color: ${themeColor};
                color: white;
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                transition: transform 0.2s ease;
            }
            .lunaos-widget-toggle:hover {
                transform: scale(1.05);
            }
            .lunaos-widget-chat {
                display: none;
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 350px;
                height: 500px;
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                border: 1px solid #e5e7eb;
                flex-direction: column;
                overflow: hidden;
            }
            .lunaos-widget-chat.is-open {
                display: flex;
            }
            .lunaos-widget-header {
                background: ${themeColor};
                color: white;
                padding: 16px;
                font-weight: 600;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .lunaos-widget-close {
                background: transparent;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 20px;
            }
            .lunaos-widget-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #f9fafb;
            }
            .lunaos-message {
                max-width: 85%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            .lunaos-message.user {
                background: ${themeColor};
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
            }
            .lunaos-message.agent {
                background: #ffffff;
                color: #111827;
                align-self: flex-start;
                border: 1px solid #e5e7eb;
                border-bottom-left-radius: 4px;
            }
            .lunaos-widget-input-area {
                padding: 12px;
                background: #ffffff;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 8px;
            }
            .lunaos-widget-input {
                flex: 1;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                outline: none;
                font-size: 14px;
            }
            .lunaos-widget-input:focus {
                border-color: ${themeColor};
            }
            .lunaos-widget-send {
                background: ${themeColor};
                color: white;
                border: none;
                padding: 0 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
            }
            .lunaos-widget-send:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .lunaos-widget-watermark {
                text-align: center;
                padding: 6px;
                background: #f3f4f6;
                font-size: 11px;
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
            }
            .lunaos-widget-watermark a {
                color: ${themeColor};
                text-decoration: none;
                font-weight: 600;
            }
            .lunaos-widget-watermark a:hover {
                text-decoration: underline;
            }
            .lunaos-typing {
                display: inline-flex;
                gap: 4px;
                padding: 4px 8px;
            }
            .lunaos-dot {
                width: 6px;
                height: 6px;
                background: #9ca3af;
                border-radius: 50%;
                animation: lunaos-bounce 1.4s infinite ease-in-out both;
            }
            .lunaos-dot:nth-child(1) { animation-delay: -0.32s; }
            .lunaos-dot:nth-child(2) { animation-delay: -0.16s; }
            @keyframes lunaos-bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Build DOM
    container.className = 'lunaos-widget-container';
    container.innerHTML = `
        <button class="lunaos-widget-toggle" id="lunaos-btn">💬</button>
        <div class="lunaos-widget-chat" id="lunaos-chat">
            <div class="lunaos-widget-header">
                <span id="lunaos-title">Chat Support</span>
                <button class="lunaos-widget-close" id="lunaos-close">×</button>
            </div>
            <div class="lunaos-widget-messages" id="lunaos-msgs"></div>
            <div class="lunaos-widget-input-area">
                <input type="text" class="lunaos-widget-input" id="lunaos-input" placeholder="Type your message..." />
                <button class="lunaos-widget-send" id="lunaos-send">Send</button>
            </div>
            <div class="lunaos-widget-watermark">
                🚀 Powered by <a href="https://lunaos.ai" target="_blank">LunaOS</a>
            </div>
        </div>
    `;

    const toggleBtn = document.getElementById('lunaos-btn');
    const closeBtn = document.getElementById('lunaos-close');
    const chatPanel = document.getElementById('lunaos-chat');
    const messagesEl = document.getElementById('lunaos-msgs');
    const inputEl = document.getElementById('lunaos-input');
    const sendBtn = document.getElementById('lunaos-send');

    let isOpen = false;
    let isWaiting = false;

    // API executing logic
    async function sendMessage(text) {
        if (!text.trim() || isWaiting) return;

        appendMessage('user', text);
        inputEl.value = '';
        isWaiting = true;
        sendBtn.disabled = true;

        const typingId = appendTyping();

        try {
            const apiBase = window.LUNAOS_API_URL || 'https://api.lunaos.ai';
            const response = await fetch(`${apiBase}/agents/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    agent: agentId,
                    context: text
                })
            });

            removeMessage(typingId);

            if (!response.ok) {
                const errText = await response.text();
                appendMessage('agent', `❌ Error: ${errText || response.statusText}`);
                isWaiting = false;
                sendBtn.disabled = false;
                return;
            }

            // Read SSE
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let agentReplyBodyEl = appendMessage('agent', '');
            let fullReply = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataStr);
                            if (data.executionId) {
                                // Done event
                                continue;
                            }
                            if (data.error) {
                                fullReply += '\\n❌ ' + data.error;
                                agentReplyBodyEl.innerHTML = formatText(fullReply);
                                continue;
                            }
                        } catch (e) {
                            // Raw token text if not JSON
                            if (!dataStr.startsWith('{')) {
                                fullReply += dataStr;
                                agentReplyBodyEl.innerHTML = formatText(fullReply);
                            }
                        }
                    }
                }
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        } catch (error) {
            removeMessage(typingId);
            appendMessage('agent', `❌ Connection error: ${error.message}`);
        } finally {
            isWaiting = false;
            sendBtn.disabled = false;
            inputEl.focus();
        }
    }

    // UI Helpers
    function appendMessage(role, text) {
        const id = 'msg-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = `lunaos-message ${role}`;
        div.innerHTML = formatText(text);
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    function appendTyping() {
        const id = 'msg-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = `lunaos-message agent`;
        div.innerHTML = `<div class="lunaos-typing"><div class="lunaos-dot"></div><div class="lunaos-dot"></div><div class="lunaos-dot"></div></div>`;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function formatText(text) {
        return text.replace(/\\n/g, '<br/>');
    }

    // Event Listeners
    toggleBtn.addEventListener('click', () => {
        isOpen = !isOpen;
        if (isOpen) {
            chatPanel.classList.add('is-open');
            toggleBtn.innerHTML = '✖';
            inputEl.focus();
            if (messagesEl.children.length === 0) {
                appendMessage('agent', 'Hello! How can I help you today?');
            }
        } else {
            chatPanel.classList.remove('is-open');
            toggleBtn.innerHTML = '💬';
        }
    });

    closeBtn.addEventListener('click', () => {
        isOpen = false;
        chatPanel.classList.remove('is-open');
        toggleBtn.innerHTML = '💬';
    });

    sendBtn.addEventListener('click', () => {
        sendMessage(inputEl.value);
    });

    inputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage(inputEl.value);
        }
    });

})();
