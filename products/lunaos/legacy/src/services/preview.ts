// Live preview: compile, render, hot reload
export interface PreviewSession {
  id: string;
  code: string;
  framework: string;
  status: 'compiling' | 'compiled' | 'running' | 'error';
  url?: string;
  error?: string;
  createdAt: Date;
}

export class PreviewService {
  private sessions: Map<string, PreviewSession> = new Map();
  private portCounter = 3000;

  async createPreview(code: string, framework: string): Promise<PreviewSession> {
    const session: PreviewSession = {
      id: `preview_${Date.now()}`,
      code,
      framework,
      status: 'compiling',
      createdAt: new Date(),
    };

    this.sessions.set(session.id, session);

    // Simulate compilation
    setTimeout(() => {
      session.status = 'compiled';
      session.url = `http://localhost:${this.portCounter++}`;
    }, 500);

    return session;
  }

  async runPreview(sessionId: string): Promise<PreviewSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.status === 'error') {
      session.status = 'compiling';
      session.error = undefined;
    }

    session.status = 'running';

    // Simulate execution
    return new Promise((resolve) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          session.status = 'running';
        } else {
          session.status = 'error';
          session.error = 'Compilation failed';
        }
        resolve(session);
      }, 300);
    });
  }

  getSession(id: string): PreviewSession | undefined {
    return this.sessions.get(id);
  }

  updateCode(sessionId: string, code: string): PreviewSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.code = code;
    session.status = 'compiling';
    session.error = undefined;

    // Simulate hot reload
    setTimeout(() => {
      session.status = 'running';
    }, 300);

    return session;
  }

  stopPreview(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'compiled';
    session.url = undefined;
    return true;
  }

  deletePreview(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listSessions(): PreviewSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): PreviewSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'running');
  }

  async compileCode(code: string, framework: string): Promise<{ success: boolean; error?: string }> {
    // Simulate compilation
    return new Promise((resolve) => {
      setTimeout(() => {
        if (code.includes('syntax error')) {
          resolve({ success: false, error: 'Syntax error in code' });
        } else {
          resolve({ success: true });
        }
      }, 200);
    });
  }
}
