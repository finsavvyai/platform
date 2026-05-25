import type { GetStaticProps, NextPage } from 'next';
import Link from 'next/link';
import challenges from '../../../data/challenges.json';

interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: number;
  objective: string;
  points: number;
}

interface Props {
  challenges: Challenge[];
}

const Home: NextPage<Props> = ({ challenges }) => (
  <main style={{ font: '15px/1.6 system-ui, sans-serif', maxWidth: 720, margin: '40px auto', padding: 16 }}>
    <h1 style={{ fontSize: 28 }}>SDLC Arena</h1>
    <p style={{ color: '#475569' }}>
      Find prompt-injection, jailbreak, PII-leak, and system-prompt-extraction
      attacks that bypass <strong>sdlc-guard</strong>. Each successful bypass
      becomes labelled training data for the next release.
    </p>
    <ol style={{ paddingLeft: 0, listStyle: 'none' }}>
      {challenges.map((c) => (
        <li key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <Link href={`/play/${c.id}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{c.title}</strong>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>+{c.points} pts</span>
            </div>
            <div style={{ color: '#64748b', fontSize: 13 }}>
              {c.category} · difficulty {c.difficulty}/5
            </div>
            <p style={{ marginTop: 8 }}>{c.objective}</p>
          </Link>
        </li>
      ))}
    </ol>
    <footer style={{ marginTop: 32, color: '#64748b', fontSize: 13 }}>
      Model: <a href="https://huggingface.co/sdlc-ai/sdlc-guard-v1">sdlc-ai/sdlc-guard-v1</a> ·
      Dataset: <a href="https://huggingface.co/datasets/sdlc-ai/attacks-v1">sdlc-ai/attacks-v1</a> ·
      Source: <a href="https://github.com/finsavvyai/sdlc-platform/tree/main/sdlc-arena">github</a>
    </footer>
  </main>
);

export const getStaticProps: GetStaticProps<Props> = async () => ({
  props: { challenges: challenges as Challenge[] },
});

export default Home;
