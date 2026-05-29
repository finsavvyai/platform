// SDLC Platform - Working Demo JavaScript

class SDLCDemo {
    constructor() {
        this.uploadCount = 0;
        this.queryCount = 0;
        this.piiCount = 0;
        this.documents = [];
        this.currentSessionId = null;
        this.processingTimes = [];
        this.apiBase = ''; // Same origin
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkSystemHealth();
        this.updateDashboard();
        this.loadDocuments();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');

        // File upload events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.handleFiles(files);
        });

        // Chat events
        sendButton.addEventListener('click', () => this.sendMessage());
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Clear file input after selection
        fileInput.addEventListener('change', () => {
            setTimeout(() => {
                fileInput.value = '';
            }, 100);
        });
    }

    async checkSystemHealth() {
        try {
            const response = await fetch(`${this.apiBase}/api/health`);
            const health = await response.json();

            if (health.status === 'healthy') {
                this.updateSystemStatus('System Online', 'success');
            } else {
                this.updateSystemStatus('System Issues', 'warning');
            }
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateSystemStatus('Connection Issues', 'error');
        }
    }

    updateSystemStatus(status, type) {
        const statusElement = document.getElementById('systemStatus');
        const icon = statusElement.querySelector('i');

        statusElement.innerHTML = `<i class="fas fa-circle"></i> ${status}`;

        if (type === 'success') {
            icon.style.color = '#4caf50';
        } else if (type === 'warning') {
            icon.style.color = '#ff9800';
        } else {
            icon.style.color = '#f44336';
        }
    }

    async handleFiles(files) {
        const uploadProgress = document.getElementById('uploadProgress');
        const progressBar = uploadProgress.querySelector('.progress-fill');
        const progressText = uploadProgress.querySelector('.progress-text');

        for (const file of files) {
            try {
                // Show progress
                uploadProgress.style.display = 'block';
                progressBar.style.width = '0%';
                progressText.textContent = `Uploading ${file.name}...`;

                const formData = new FormData();
                formData.append('document', file);

                const startTime = Date.now();

                // Simulate progress
                const progressInterval = setInterval(() => {
                    const currentWidth = parseFloat(progressBar.style.width) || 0;
                    const newWidth = Math.min(currentWidth + 10, 90);
                    progressBar.style.width = `${newWidth}%`;
                }, 100);

                const response = await fetch(`${this.apiBase}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                clearInterval(progressInterval);
                progressBar.style.width = '100%';

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.statusText}`);
                }

                const result = await response.json();
                const processingTime = Date.now() - startTime;

                if (result.success) {
                    this.handleUploadSuccess(result, processingTime);
                    progressText.textContent = `Successfully processed ${file.name}!`;
                } else {
                    throw new Error(result.message || 'Upload failed');
                }

                setTimeout(() => {
                    uploadProgress.style.display = 'none';
                }, 2000);

            } catch (error) {
                console.error('Upload error:', error);
                progressText.textContent = `Error: ${error.message}`;
                progressBar.style.width = '0%';

                setTimeout(() => {
                    uploadProgress.style.display = 'none';
                }, 3000);
            }
        }
    }

    handleUploadSuccess(result, processingTime) {
        this.uploadCount++;
        this.documents.push(result);
        this.processingTimes.push(processingTime);

        // Update PII count
        if (result.piiDetected && result.piiDetected.hasPII) {
            this.piiCount += Object.keys(result.piiDetected.types).length;
            this.showPIIResults(result.piiDetected);
        }

        // Update UI
        this.updateDashboard();
        this.updateDocumentList();
        this.enableChat();

        // Show success notification
        this.showNotification('Document uploaded successfully!', 'success');
    }

    showPIIResults(piiData) {
        const piiResults = document.getElementById('piiResults');
        const piiContent = document.getElementById('piiContent');

        let html = '<div class="pii-alert">';
        html += '<p><strong>🔒 PII Detected and Automatically Protected:</strong></p>';
        html += '<ul>';

        Object.entries(piiData.types).forEach(([type, info]) => {
            html += `<li><strong>${type.charAt(0).toUpperCase() + type.slice(1)}:</strong> ${info.count} instance(s) found</li>`;
        });

        html += '</ul>';
        html += `<p><em>Risk Level: ${piiData.riskLevel} | Auto-redaction: ${piiData.autoRedacted ? 'Active' : 'Inactive'}</em></p>`;
        html += '</div>';

        piiContent.innerHTML = html;
        piiResults.style.display = 'block';
        piiResults.classList.add('fade-in');
    }

    updateDocumentList() {
        const documentGrid = document.getElementById('documentGrid');

        if (this.documents.length === 0) {
            documentGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No documents uploaded yet</p>
                    <p>Upload a document above to get started</p>
                </div>
            `;
            return;
        }

        const documentsHtml = this.documents.map(doc => {
            const hasPII = doc.piiDetected && doc.piiDetected.hasPII;
            const statusClass = hasPII ? 'warning' : 'safe';
            const statusText = hasPII ? 'PII Protected' : 'Clean';

            return `
                <div class="document-item slide-in">
                    <div class="document-info">
                        <div class="document-icon">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div class="document-details">
                            <h4>${doc.originalName}</h4>
                            <p>${this.formatFileSize(doc.size)} • Uploaded ${this.formatTime(doc.uploadedAt || new Date())}</p>
                        </div>
                    </div>
                    <div class="document-status">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
            `;
        }).join('');

        documentGrid.innerHTML = documentsHtml;
    }

    enableChat() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const inputStatus = document.getElementById('inputStatus');

        chatInput.disabled = false;
        sendButton.disabled = false;
        inputStatus.textContent = 'Ready to chat about your documents';

        // Remove welcome message if present
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();

        if (!message) return;
        if (this.documents.length === 0) {
            this.showNotification('Please upload a document first!', 'warning');
            return;
        }

        // Add user message to chat
        this.addMessageToChat('user', message);
        chatInput.value = '';

        // Disable input during processing
        this.setChatInputState(false, 'Processing...');

        try {
            const startTime = Date.now();

            const response = await fetch(`${this.apiBase}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: message,
                    fileId: this.documents[0]?.fileId,
                    sessionId: this.currentSessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Chat request failed: ${response.statusText}`);
            }

            const result = await response.json();
            const processingTime = Date.now() - startTime;

            this.handleChatSuccess(result, processingTime);

        } catch (error) {
            console.error('Chat error:', error);
            this.addMessageToChat('assistant', `I apologize, but I encountered an error: ${error.message}. Please try again.`);
        } finally {
            this.setChatInputState(true, 'Ready');
        }
    }

    handleChatSuccess(result, processingTime) {
        this.queryCount++;
        this.currentSessionId = result.sessionId;
        this.processingTimes.push(processingTime);

        // Add assistant response to chat
        let responseText = result.response;

        // Add sources information
        if (result.sources && result.sources.length > 0) {
            responseText += this.formatSources(result.sources);
        }

        // Add audit information
        responseText += `\n\n<small><em>Audit ID: ${result.auditId} | Security: ${result.securityLevel} | Compliance: ${result.complianceChecked ? 'Verified' : 'Pending'}</em></small>`;

        this.addMessageToChat('assistant', responseText);
        this.updateDashboard();
    }

    formatSources(sources) {
        let sourcesHtml = '<div class="message-sources">';
        sourcesHtml += '<strong>Sources:</strong><ul>';

        sources.forEach(source => {
            sourcesHtml += `<li>${source.documentName} (Confidence: ${Math.round(source.confidence * 100)}%)</li>`;
        });

        sourcesHtml += '</ul></div>';
        return sourcesHtml;
    }

    addMessageToChat(type, content) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type} fade-in`;

        const avatar = type === 'user' ?
            '<i class="fas fa-user"></i>' :
            '<i class="fas fa-robot"></i>';

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">${content}</div>
        `;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setChatInputState(enabled, status) {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const inputStatus = document.getElementById('inputStatus');
        const chatStatus = document.getElementById('chatStatus');

        chatInput.disabled = !enabled;
        sendButton.disabled = !enabled;
        inputStatus.textContent = status;
        chatStatus.textContent = enabled ? 'Ready' : 'Processing...';
    }

    updateDashboard() {
        document.getElementById('uploadCount').textContent = this.uploadCount;
        document.getElementById('queryCount').textContent = this.queryCount;
        document.getElementById('piiCount').textContent = this.piiCount;

        // Calculate average processing time
        const avgTime = this.processingTimes.length > 0 ?
            Math.round(this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length) :
            0;
        document.getElementById('processingTime').textContent = `${avgTime}ms`;

        // Update session metrics
        document.getElementById('dataProtected').textContent = `${this.piiCount} items`;
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.apiBase}/api/documents`);
            if (response.ok) {
                const data = await response.json();
                // Demo doesn't persist documents, so we'll keep the in-memory state
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        }
    }

    showNotification(message, type) {
        // Create a simple notification (could be enhanced with a toast library)
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in`;
        notification.textContent = message;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            maxWidth: '300px'
        });

        if (type === 'success') {
            notification.style.background = '#4caf50';
        } else if (type === 'warning') {
            notification.style.background = '#ff9800';
        } else {
            notification.style.background = '#f44336';
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }
}

// Initialize the demo when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sdlcDemo = new SDLCDemo();
});

// Global function for sending messages (called from HTML)
function sendMessage() {
    if (window.sdlcDemo) {
        window.sdlcDemo.sendMessage();
    }
}