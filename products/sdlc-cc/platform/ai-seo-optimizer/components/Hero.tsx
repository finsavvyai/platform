import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Eye, TrendingUp } from 'lucide-react';
import { Button } from './Button';
import { ScoreRing } from './ScoreRing';

const Hero = () => {
  const agents = [
    { name: 'ChatGPT', score: 87, color: '#10B981' },
    { name: 'Perplexity', score: 72, color: '#F59E0B' },
    { name: 'Gemini', score: 64, color: '#F59E0B' },
    { name: 'Claude', score: 91, color: '#10B981' },
  ];

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-primary-200 blur-[100px]" />
        <div className="absolute top-40 right-[15%] w-96 h-96 rounded-full bg-accent-200 blur-[120px]" />
        <div className="absolute bottom-0 left-[40%] w-64 h-64 rounded-full bg-primary-100 blur-[80px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-slate-700">
                SEO for the AI era
              </span>
            </div>

            <h1 className="text-4xl md:text-[56px] font-bold tracking-tight text-slate-950 mb-6 leading-[1.08]">
              Get discovered by
              <span className="gradient-text block mt-1">AI agents, not just search engines</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-xl mb-8 leading-relaxed">
              RankAI analyzes how ChatGPT, Perplexity, Gemini, and Claude
              see your content — then optimizes it so AI agents cite you
              as the authoritative source.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium bg-primary-50 border border-primary-200 text-primary-700">
                <Eye className="h-3.5 w-3.5" /> AI Visibility Score
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium bg-accent-50 border border-accent-200 text-accent-700">
                <TrendingUp className="h-3.5 w-3.5" /> Citation Tracking
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button href="#waitlist" variant="primary" size="lg">
                Join the Waitlist
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button href="#how-it-works" variant="secondary" size="lg">
                See How It Works
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="glass-panel rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2.5 h-2.5 rounded-full bg-score-high animate-pulse-slow" />
                <span className="text-sm font-medium text-slate-700">
                  Live AI Visibility Report
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {agents.map((agent, i) => (
                  <motion.div
                    key={agent.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="metric-card flex flex-col items-center py-4"
                  >
                    <ScoreRing score={agent.score} size={80} />
                    <span className="text-sm font-medium text-slate-700 mt-2">
                      {agent.name}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">
                    Overall AI Visibility
                  </span>
                  <span className="text-2xl font-bold gradient-text">78</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6D28D9, #06B6D4)' }}
                    initial={{ width: 0 }}
                    whileInView={{ width: '78%' }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Your content is cited by 3 of 4 major AI agents
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
