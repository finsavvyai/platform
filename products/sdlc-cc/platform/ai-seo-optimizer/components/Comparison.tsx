import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';

const rows = [
  { label: 'Optimizes for', old: 'Google crawlers', modern: 'AI agents + search' },
  { label: 'Success metric', old: 'Keyword rankings', modern: 'AI citation rate' },
  { label: 'Content format', old: 'Keyword-stuffed pages', modern: 'Fact-dense, structured' },
  { label: 'Tracking', old: 'SERP position', modern: 'Agent mention monitoring' },
  { label: 'Access control', old: 'robots.txt only', modern: 'robots.txt + ai.txt' },
  { label: 'Discovery', old: 'Blue links', modern: 'AI-generated answers' },
];

const Comparison = () => {
  return (
    <section className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Traditional SEO vs. AI SEO
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            The game has changed. Here&apos;s what&apos;s different.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Old SEO
              </span>
            </div>
            <div className="px-6 py-4 text-center">
              <span className="text-sm font-semibold gradient-text uppercase tracking-wide">
                RankAI
              </span>
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-3 ${i < rows.length - 1 ? 'border-b border-slate-50' : ''}`}
            >
              <div className="px-6 py-4">
                <span className="text-sm font-medium text-slate-800">{row.label}</span>
              </div>
              <div className="px-6 py-4 text-center flex items-center justify-center gap-2">
                <X className="h-4 w-4 text-slate-300 flex-shrink-0" />
                <span className="text-sm text-slate-500">{row.old}</span>
              </div>
              <div className="px-6 py-4 text-center flex items-center justify-center gap-2">
                <Check className="h-4 w-4 text-score-high flex-shrink-0" />
                <span className="text-sm text-slate-800 font-medium">{row.modern}</span>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Comparison;
