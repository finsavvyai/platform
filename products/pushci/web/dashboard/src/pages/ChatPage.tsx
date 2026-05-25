import { useState, useCallback, useEffect } from 'react';
import ChatInterface, { type Message } from '../components/ChatInterface';
import ChatEmptyState from '../components/ChatEmptyState';
import { useProjects } from '../hooks/useProjects';
import { API_BASE_URL } from '../config';
import { dispatchAction } from '../lib/chatActionDispatcher';
import { pollRunStatus } from '../lib/runPolling';

const categories = [
  { label: 'Pipeline', items: ['generate pipeline', 'fix my pipeline', 'optimize my pipeline'] },
  { label: 'Run & Deploy', items: ['run all checks', 'deploy to staging', 'deploy to production'] },
  { label: 'Debug', items: ['why did my build fail?', 'diagnose last failure', 'heal my pipeline'] },
  { label: 'Manage', items: ['show pipeline status', 'list secrets', 'run only tests'] },
];

let msgId = 0;

export default function ChatPage() {
  const { projects, loading: projectsLoading } = useProjects();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  useEffect(() => {
    if (!selectedRepo && projects.length === 1) {
      setSelectedRepo(projects[0].repo);
    }
  }, [projects, selectedRepo]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = { id: `m-${++msgId}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const token = localStorage.getItem('pushci_token');
    const assistantId = `m-${++msgId}`;

    try {
      const body: Record<string, unknown> = { message: text };
      if (selectedRepo) body.repoContext = { root: selectedRepo };
      const res = await fetch(`${API_BASE_URL}/api/nlp/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        action?: string;
        params?: Record<string, unknown>;
        message?: string;
        error?: string;
      };

      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        text: data.message ?? data.error ?? 'Done.',
        action: data.action,
        params: data.params,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // If Claude picked a tool, dispatch it. The dispatcher knows how
      // to call the right endpoint, stub the deferred actions, and
      // surface a structured result for ActionResultCard to render.
      if (data.action && token) {
        const result = await dispatchAction({
          action: data.action,
          params: data.params ?? {},
          token,
          repoContext: selectedRepo ? { root: selectedRepo } : undefined,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, result } : m)),
        );

        // Async actions return a runId — long-poll until terminal.
        if (result.state === 'polling' && result.runId) {
          const poll = await pollRunStatus(result.runId, token);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    result: {
                      state: poll.status === 'succeeded' ? 'success' : 'error',
                      action: result.action,
                      data: poll.run,
                      error: poll.status === 'succeeded'
                        ? undefined
                        : `Run ended with status: ${poll.status}`,
                    },
                  }
                : m,
            ),
          );
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `m-${++msgId}`, role: 'assistant', text: 'Failed to reach API.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedRepo]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-7rem)] sm:h-[calc(100vh-4rem)]">
      <aside className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto">
        <div className="flex lg:flex-col gap-1 p-3 lg:p-4">
          <ProjectPicker
            projects={projects}
            loading={projectsLoading}
            selected={selectedRepo}
            onChange={setSelectedRepo}
          />
          {categories.map((cat) => (
            <div key={cat.label} className="flex-shrink-0 lg:mb-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 lg:mb-2 hidden lg:block">
                {cat.label}
              </h3>
              <div className="flex lg:flex-col gap-1">
                {cat.items.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)}
                    className="sm:whitespace-nowrap truncate text-left text-sm px-3 py-2 rounded-lg text-zinc-300
                               hover:bg-zinc-800 hover:text-emerald-400 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-h-0">
        {messages.length === 0 && <ChatEmptyState onSend={sendMessage} />}
        <ChatInterface messages={messages} onSend={sendMessage} loading={loading} />
      </div>
    </div>
  );
}

interface Project { id: string; repo: string }

function ProjectPicker({
  projects, loading, selected, onChange,
}: {
  projects: Project[];
  loading: boolean;
  selected: string;
  onChange: (repo: string) => void;
}) {
  return (
    <div className="flex-shrink-0 lg:mb-4 min-w-[160px] sm:min-w-[200px] lg:w-full">
      <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
        Project
      </label>
      {loading ? (
        <div className="h-9 rounded-lg bg-zinc-800/50 border border-zinc-800 animate-pulse" />
      ) : projects.length === 0 ? (
        <div className="text-xs text-zinc-500 leading-relaxed">
          No projects connected yet.
          <a href="/projects" className="block text-accent hover:underline mt-1">
            Connect a project →
          </a>
        </div>
      ) : (
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-sm bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2
                     text-zinc-100 focus:outline-none focus:border-emerald-500/50 transition-colors"
        >
          <option value="">— none (generic advice) —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.repo}>{p.repo}</option>
          ))}
        </select>
      )}
    </div>
  );
}
