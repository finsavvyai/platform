import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Share2 } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import UrlInput from '../../components/analyze/UrlInput';
import ResultsSummary from '../../components/analyze/ResultsSummary';
import AgentScoreCards from '../../components/analyze/AgentScoreCards';
import SignalGroup from '../../components/analyze/SignalGroup';
import type { AnalysisResult } from '../../lib/types';

export default function AnalyzePage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (url: string) => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI Visibility Analyzer | RankAI</title>
        <meta name="description" content="Analyze how AI agents see your content. Get your AI Visibility Score and actionable optimization recommendations." />
      </Head>

      <div className="min-h-screen">
        <Header />
        <main className="pt-32 pb-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <HeroSection />
            <div className="mt-10">
              <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
            </div>
            {error && <ErrorMessage message={error} />}
            {result && <AnalysisResults result={result} />}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function HeroSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 mb-6">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-slate-700">Free AI visibility audit</span>
      </div>
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 mb-4">
        How do AI agents see <span className="gradient-text">your content?</span>
      </h1>
      <p className="text-lg text-slate-600 max-w-2xl mx-auto">
        Enter any URL. We&apos;ll score it across 16 signals that ChatGPT,
        Perplexity, Claude, and Gemini use to decide what to cite.
      </p>
    </motion.div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-6 text-center text-red-600 text-sm"
    >
      {message}
    </motion.div>
  );
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const scoreId = typeof window !== 'undefined'
    ? btoa(`${result.overallScore}|${result.url}`)
    : '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="mt-10 space-y-6"
    >
      <ResultsSummary
        url={result.url}
        score={result.overallScore}
        summary={result.summary}
        timestamp={result.timestamp}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center"
      >
        <Link
          href={`/score/${scoreId}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-brand text-white font-semibold text-sm shadow-glow hover:shadow-lg transition-all hover:-translate-y-0.5"
        >
          <Share2 className="h-4 w-4" />
          Share your score — roast yourself
        </Link>
      </motion.div>

      <AgentScoreCards scores={result.agentScores} />
      <div className="grid md:grid-cols-2 gap-6">
        <SignalGroup title="Content Structure" signals={result.signals.structure} />
        <SignalGroup title="Authority Signals" signals={result.signals.authority} />
        <SignalGroup title="AI Readiness" signals={result.signals.aiReadiness} />
        <SignalGroup title="Technical SEO" signals={result.signals.technical} />
      </div>
    </motion.div>
  );
}
