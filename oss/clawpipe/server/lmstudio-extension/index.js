/**
 * FinSavvyAI Extension for LM Studio
 * Adds NotebookLM features: document management, RAG, notebooks
 */

class FinSavvyAIExtension {
  constructor(context) {
    this.context = context;
    this.apiBaseUrl = 'http://localhost:8080';
    this.sources = [];
    this.notebooks = [];
  }

  async onActivate() {
    console.log('🚀 FinSavvyAI Extension activated!');
    
    // Register sidebar panel
    this.context.ui.registerPanel({
      id: 'finsavvyai-panel',
      title: '📚 NotebookLM',
      icon: 'book',
      component: this.renderPanel.bind(this)
    });

    // Register chat commands
    this.context.chat.registerCommand({
      name: 'upload',
      description: 'Upload a document to FinSavvyAI',
      handler: this.handleUploadCommand.bind(this)
    });

    this.context.chat.registerCommand({
      name: 'sources',
      description: 'List all uploaded sources',
      handler: this.handleSourcesCommand.bind(this)
    });

    this.context.chat.registerCommand({
      name: 'notebook',
      description: 'Create or manage notebooks',
      handler: this.handleNotebookCommand.bind(this)
    });

    // Load initial data
    await this.loadSources();
    await this.loadNotebooks();
  }

  async renderPanel() {
    return `
      <div class="finsavvyai-panel" style="padding: 16px;">
        <h2>📚 FinSavvyAI NotebookLM</h2>
        
        <!-- Upload Section -->
        <div class="section">
          <h3>📄 Upload Document</h3>
          <textarea id="docContent" placeholder="Paste your document text here..." 
                    style="width: 100%; height: 100px; margin: 8px 0;"></textarea>
          <input type="text" id="docName" placeholder="Document name (e.g., paper.txt)" 
                 style="width: 70%; margin-right: 8px;">
          <button onclick="window.finSavvyAI.uploadDocument()">Upload</button>
        </div>

        <!-- Sources Section -->
        <div class="section">
          <h3>📚 Sources (${this.sources.length})</h3>
          <div id="sourcesList" style="max-height: 200px; overflow-y: auto;">
            ${this.renderSourcesList()}
          </div>
        </div>

        <!-- Notebooks Section -->
        <div class="section">
          <h3>📓 Notebooks (${this.notebooks.length})</h3>
          <button onclick="window.finSavvyAI.createNotebook()">+ New Notebook</button>
          <div id="notebooksList" style="max-height: 200px; overflow-y: auto; margin-top: 8px;">
            ${this.renderNotebooksList()}
          </div>
        </div>

        <!-- Status -->
        <div class="section" style="margin-top: 16px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
          <small>💡 Gateway: ${this.apiBaseUrl}</small><br>
          <small id="status">Ready</small>
        </div>
      </div>
    `;
  }

  renderSourcesList() {
    if (this.sources.length === 0) {
      return '<p style="color: #666; font-style: italic;">No sources uploaded yet</p>';
    }
    
    return this.sources.map(source => `
      <div style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;" 
           onclick="window.finSavvyAI.showSource('${source.id}')">
        <strong>${source.name}</strong><br>
        <small>${source.chunks} chunks • ${source.size} bytes</small>
      </div>
    `).join('');
  }

  renderNotebooksList() {
    if (this.notebooks.length === 0) {
      return '<p style="color: #666; font-style: italic;">No notebooks created yet</p>';
    }
    
    return this.notebooks.map(nb => `
      <div style="padding: 8px; border-bottom: 1px solid #eee;">
        <strong>${nb.name}</strong><br>
        <small>${nb.sections} sections</small>
      </div>
    `).join('');
  }

  async loadSources() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/notebook/sources`);
      const data = await response.json();
      this.sources = data.sources || [];
      this.updateStatus(`Loaded ${this.sources.length} sources`);
    } catch (error) {
      this.updateStatus('Error loading sources: ' + error.message);
    }
  }

  async loadNotebooks() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/notebook/notebooks`);
      const data = await response.json();
      this.notebooks = data.notebooks || [];
      this.updateStatus(`Loaded ${this.notebooks.length} notebooks`);
    } catch (error) {
      this.updateStatus('Error loading notebooks: ' + error.message);
    }
  }

  async uploadDocument() {
    const content = document.getElementById('docContent').value;
    const filename = document.getElementById('docName').value || 'document.txt';

    if (!content.trim()) {
      alert('Please enter some content');
      return;
    }

    this.updateStatus('Uploading...');

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/notebook/sources/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: filename,
          file_type: 'text',
          content: content
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.updateStatus(`✅ Uploaded: ${result.name}`);
        document.getElementById('docContent').value = '';
        document.getElementById('docName').value = '';
        await this.loadSources();
      } else {
        this.updateStatus(`❌ Upload failed: ${result.error}`);
      }
    } catch (error) {
      this.updateStatus(`❌ Error: ${error.message}`);
    }
  }

  async createNotebook() {
    const name = prompt('Enter notebook name:');
    if (!name) return;

    this.updateStatus('Creating notebook...');

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/notebook/notebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const result = await response.json();

      if (response.ok) {
        this.updateStatus(`✅ Created: ${result.name}`);
        await this.loadNotebooks();
      } else {
        this.updateStatus(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      this.updateStatus(`❌ Error: ${error.message}`);
    }
  }

  updateStatus(message) {
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  async handleUploadCommand(args) {
    // Handle /upload command from chat
    const text = args.join(' ');
    if (!text) {
      return 'Usage: /upload <document text>';
    }

    const response = await fetch(`${this.apiBaseUrl}/api/notebook/sources/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'chat-upload.txt',
        file_type: 'text',
        content: text
      })
    });

    const result = await response.json();
    if (response.ok) {
      await this.loadSources();
      return `✅ Uploaded document: ${result.name} (${result.chunks} chunks)`;
    } else {
      return `❌ Upload failed: ${result.error}`;
    }
  }

  async handleSourcesCommand() {
    await this.loadSources();
    if (this.sources.length === 0) {
      return 'No sources uploaded yet. Use /upload to add documents.';
    }

    return `📚 Sources (${this.sources.length}):\n` + 
      this.sources.map(s => `• ${s.name} (${s.chunks} chunks)`).join('\n');
  }

  async handleNotebookCommand(args) {
    const action = args[0];

    if (action === 'create' || action === 'new') {
      const name = args.slice(1).join(' ') || 'New Notebook';
      const response = await fetch(`${this.apiBaseUrl}/api/notebook/notebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      const result = await response.json();
      if (response.ok) {
        await this.loadNotebooks();
        return `✅ Created notebook: ${result.name}`;
      }
    } else if (action === 'list') {
      await this.loadNotebooks();
      if (this.notebooks.length === 0) {
        return 'No notebooks yet. Use /notebook create <name>';
      }
      return `📓 Notebooks (${this.notebooks.length}):\n` + 
        this.notebooks.map(n => `• ${n.name} (${n.sections} sections)`).join('\n');
    }

    return 'Usage: /notebook <create|list> [name]';
  }
}

// Export for LM Studio
module.exports = FinSavvyAIExtension;
