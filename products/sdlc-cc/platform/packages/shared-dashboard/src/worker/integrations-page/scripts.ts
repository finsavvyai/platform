// AutoBoot Integration Hub - Client-side JavaScript

export const scripts = `
    <script>
        function openIntegration(type) {
            document.getElementById(type + '-modal').classList.add('active');
        }

        function closeModal(type) {
            document.getElementById(type + '-modal').classList.remove('active');
        }

        function copyKey(type) {
            const key = document.getElementById(type + '-key').textContent;
            navigator.clipboard.writeText(key);
            const btn = event.target;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
            }, 2000);
        }

        function copyCode(type) {
            const activeTab = document.querySelector(\`.code-tab.active\`).textContent.toLowerCase();
            const code = document.getElementById(type + '-code-' + activeTab).textContent;
            navigator.clipboard.writeText(code);
            event.target.textContent = 'Copied!';
            event.target.classList.add('copied');
            setTimeout(() => {
                event.target.textContent = 'Copy Code';
                event.target.classList.remove('copied');
            }, 2000);
        }

        function switchTab(type, lang) {
            // Update tab buttons
            document.querySelectorAll('.code-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.classList.add('active');

            // Show correct code block
            ['typescript', 'python', 'go', 'kotlin'].forEach(l => {
                const el = document.getElementById(type + '-code-' + l);
                if (el) el.style.display = l === lang ? 'block' : 'none';
            });
        }

        function testIntegration(type) {
            const result = document.getElementById(type + '-test-result');
            result.innerHTML = '<p style="color: var(--accent);">Testing connection...</p>';

            setTimeout(() => {
                result.innerHTML = \`
                    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; margin-top: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <span style="color: var(--accent-green); font-size: 1.25rem;">✓</span>
                            <span style="font-weight: 600; color: var(--accent-green);">Connection Successful</span>
                        </div>
                        <pre style="font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">{
  "status": "authenticated",
  "user": {
    "id": "usr_abc123",
    "email": "developer@example.com",
    "name": "Demo User"
  },
  "timestamp": "\${new Date().toISOString()}"
}</pre>
                    </div>
                \`;

                // Show success message
                document.getElementById(type + '-success').style.display = 'flex';

                // Update flow step
                document.querySelectorAll('.step-circle').forEach((circle, i) => {
                    if (i === 1) circle.classList.add('completed');
                });
            }, 1500);
        }

        // Close modal on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    </script>
</body>
</html>
`;
