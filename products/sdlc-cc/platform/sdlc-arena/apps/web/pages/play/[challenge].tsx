import type { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import { useState } from 'react';
import challenges from '../../../../data/challenges.json';

interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: number;
  system_prompt: string;
  objective: string;
  guard_threshold: number;
  points: number;
}

interface Props { challenge: Challenge; }

const Play: NextPage<Props> = ({ challenge }) => {
  const [attempt, setAttempt] = useState('');
  const [verdict, setVerdict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, attempt, objectiveAchieved: false }),
      });
      setVerdict(JSON.stringify(await res.json(), null, 2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ font: '15px/1.6 system-ui, sans-serif', maxWidth: 720, margin: '40px auto', padding: 16 }}>
      <a href="/" style={{ color: '#64748b', textDecoration: 'none' }}>← arena</a>
      <h1 style={{ fontSize: 24 }}>{challenge.title}</h1>
      <p style={{ color: '#475569' }}>{challenge.objective}</p>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer' }}>Show host system prompt</summary>
        <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
          {challenge.system_prompt}
        </pre>
      </details>

      <label style={{ display: 'block', marginTop: 24, fontWeight: 500 }}>Your attack</label>
      <textarea
        value={attempt}
        onChange={(e) => setAttempt(e.target.value)}
        rows={6}
        style={{ width: '100%', padding: 12, fontFamily: 'monospace' }}
      />
      <button
        onClick={submit}
        disabled={busy || !attempt.trim()}
        style={{ marginTop: 12, padding: '8px 14px', background: '#0f172a', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}
      >
        {busy ? 'Scoring…' : 'Submit'}
      </button>

      {verdict && (
        <pre style={{ marginTop: 24, background: '#f8fafc', padding: 16, borderRadius: 8, overflow: 'auto' }}>
          {verdict}
        </pre>
      )}
    </main>
  );
};

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (challenges as Challenge[]).map((c) => ({ params: { challenge: c.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  const id = ctx.params?.challenge as string;
  const challenge = (challenges as Challenge[]).find((c) => c.id === id);
  if (!challenge) return { notFound: true };
  return { props: { challenge } };
};

export default Play;
