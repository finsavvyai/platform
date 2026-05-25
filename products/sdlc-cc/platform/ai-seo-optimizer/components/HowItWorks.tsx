import { motion } from 'framer-motion';
import { Link2, ScanSearch, Wand2, TrendingUp } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Link2,
    title: 'Connect Your Site',
    description: 'Drop in your URL or sitemap. RankAI crawls your pages and maps every content signal AI agents look for.',
  },
  {
    number: '02',
    icon: ScanSearch,
    title: 'AI Agent Audit',
    description: 'We query ChatGPT, Perplexity, Gemini, and Claude about your topics — then track if and how they cite you.',
  },
  {
    number: '03',
    icon: Wand2,
    title: 'Optimize & Restructure',
    description: 'Get precise, AI-generated recommendations: schema fixes, content rewrites, FAQ blocks, and structured data.',
  },
  {
    number: '04',
    icon: TrendingUp,
    title: 'Track & Grow',
    description: 'Monitor your AI Visibility Score over time. See citation trends, track competitors, and measure ROI.',
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Four steps to AI visibility
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            From audit to optimization in minutes, not months.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="relative"
              >
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-48px)] h-px border-t-2 border-dashed border-slate-200" />
                )}

                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div className="w-20 h-20 rounded-3xl bg-white border-2 border-slate-100 flex items-center justify-center shadow-card">
                      <Icon className="h-8 w-8 text-primary-600" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-gradient-brand text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
