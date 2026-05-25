import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import ScoreCard from '../../components/share/ScoreCard';
import MessageGenerator from '../../components/share/MessageGenerator';
import ShareButtons from '../../components/share/ShareButtons';
import ViralNudge from '../../components/share/ViralNudge';
import CurbMoment from '../../components/share/CurbMoment';
import CurbMonologue from '../../components/share/CurbMonologue';
import CurbShareButton from '../../components/share/CurbShareButton';
import { getCurbEpisodeTitle } from '../../lib/curb';

export default function ScorePage() {
  const router = useRouter();
  const { id } = router.query;
  const params = parseScoreId(id as string);
  const [currentMessage, setCurrentMessage] = useState('');
  const [mode, setMode] = useState<'normal' | 'curb'>('normal');
  const [curbReady, setCurbReady] = useState(false);

  const episodeTitle = useMemo(
    () => (params ? getCurbEpisodeTitle(params.score) : ''),
    [params]
  );

  if (!params) return <FallbackState />;

  const { score, url } = params;
  const shareUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://rankai.io/score/${id}`;

  return (
    <>
      <Head>
        <title>{score}/100 AI Visibility Score | RankAI</title>
        <meta name="description" content={`This site scored ${score}/100 on AI visibility. How does yours compare?`} />
        <meta property="og:title" content={`${score}/100 — AI Visibility Score`} />
        <meta property="og:description" content={`I just checked my AI visibility score. ${score >= 60 ? 'Not bad.' : 'Ouch.'} Check yours at RankAI.`} />
        <meta property="og:type" content="website" />
        <meta property="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen">
        <Header />
        <main className="pt-32 pb-20">
          <div className="max-w-lg mx-auto px-4 sm:px-6">
            <BackLink />
            <ModeToggle mode={mode} onToggle={setMode} onCurbReset={() => setCurbReady(false)} />

            {mode === 'normal' ? (
              <NormalMode
                score={score} url={url} shareUrl={shareUrl}
                currentMessage={currentMessage}
                onMessageChange={setCurrentMessage}
              />
            ) : (
              <CurbMode
                score={score} url={url} shareUrl={shareUrl}
                episodeTitle={episodeTitle}
                ready={curbReady}
                onReady={() => setCurbReady(true)}
              />
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function BackLink() {
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <Link href="/analyze" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Analyze another URL
      </Link>
    </motion.div>
  );
}

interface ModeToggleProps {
  mode: 'normal' | 'curb';
  onToggle: (m: 'normal' | 'curb') => void;
  onCurbReset: () => void;
}

function ModeToggle({ mode, onToggle, onCurbReset }: ModeToggleProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <button
        onClick={() => onToggle('normal')}
        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${mode === 'normal' ? 'bg-primary text-white shadow-glow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
      >
        Viral Mode
      </button>
      <button
        onClick={() => { onToggle('curb'); onCurbReset(); }}
        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${mode === 'curb' ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
      >
        Curb Mode
      </button>
    </div>
  );
}

interface NormalModeProps {
  score: number; url: string; shareUrl: string;
  currentMessage: string; onMessageChange: (m: string) => void;
}

function NormalMode({ score, url, shareUrl, currentMessage, onMessageChange }: NormalModeProps) {
  return (
    <div className="space-y-6">
      <ScoreCard score={score} url={url} />
      <ViralNudge score={score} />
      <MessageGenerator score={score} onMessageChange={onMessageChange} />
      <ShareButtons message={currentMessage} url={shareUrl} score={score} />
      <ChallengeBlock />
    </div>
  );
}

interface CurbModeProps {
  score: number; url: string; shareUrl: string;
  episodeTitle: string; ready: boolean; onReady: () => void;
}

function CurbMode({ score, url, shareUrl, episodeTitle, ready, onReady }: CurbModeProps) {
  return (
    <div className="space-y-6">
      <CurbMoment score={score} episodeTitle={episodeTitle} onComplete={onReady} />
      {ready && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <CurbMonologue score={score} />
          <CurbShareButton score={score} episodeTitle={episodeTitle} url={shareUrl} />
          <ChallengeBlock />
        </motion.div>
      )}
    </div>
  );
}

function ChallengeBlock() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-5 text-center">
      <Sparkles className="h-5 w-5 text-primary mx-auto mb-2" />
      <p className="text-sm font-semibold text-slate-800 mb-1">Challenge a friend</p>
      <p className="text-xs text-slate-500 mb-3">Tag them when you share. Lowest score buys coffee.</p>
      <Link href="/analyze" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-600 transition-colors">
        Analyze their site too
      </Link>
    </motion.div>
  );
}

function FallbackState() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-32 pb-20">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Score not found</h1>
          <p className="text-slate-600 mb-6">This score link may have expired or be invalid.</p>
          <Link href="/analyze" className="button-primary text-sm px-6 py-3">Check your own score</Link>
        </div>
      </main>
    </div>
  );
}

function parseScoreId(id: string | undefined): { score: number; url: string } | null {
  if (!id) return null;
  try {
    const decoded = atob(id);
    const [scoreStr, ...urlParts] = decoded.split('|');
    const score = parseInt(scoreStr, 10);
    const url = urlParts.join('|');
    if (isNaN(score) || score < 0 || score > 100 || !url) return null;
    return { score, url };
  } catch {
    return null;
  }
}
