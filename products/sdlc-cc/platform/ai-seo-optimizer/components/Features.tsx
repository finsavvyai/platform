import { motion } from 'framer-motion';
import {
  Bot, Search, BarChart3, FileText,
  Zap, Shield,
} from 'lucide-react';
import { Card } from './Card';
import { Feature } from '../types';

const iconMap: Record<string, React.ElementType> = {
  Bot, Search, BarChart3, FileText, Zap, Shield,
};

const features: Feature[] = [
  {
    title: 'AI Agent Monitoring',
    description: 'Track how ChatGPT, Perplexity, Gemini, and Claude reference and cite your content in real time.',
    icon: 'Bot',
    details: [
      'Cross-agent citation tracking',
      'Real-time mention alerts',
      'Source attribution analysis',
      'Competitive citation comparison',
    ],
  },
  {
    title: 'Content Structure Analysis',
    description: 'Score your pages on the signals AI agents prioritize: factual density, structured data, and authority markers.',
    icon: 'Search',
    details: [
      'Schema.org validation',
      'Heading hierarchy audit',
      'Fact density scoring',
      'Answer-readiness grading',
    ],
  },
  {
    title: 'AI Visibility Score',
    description: 'A single metric that shows how likely AI agents are to surface your content when answering questions.',
    icon: 'BarChart3',
    details: [
      'Per-agent breakdown',
      'Historical trend tracking',
      'Industry benchmarking',
      'Actionable score drivers',
    ],
  },
  {
    title: 'Content Optimization',
    description: 'AI-powered recommendations that rewrite and restructure content for maximum AI agent discoverability.',
    icon: 'FileText',
    details: [
      'One-click rewrites',
      'Structured data injection',
      'FAQ block generation',
      'Citation-magnet formatting',
    ],
  },
  {
    title: 'Answer Engine Optimization',
    description: 'Purpose-built for the post-search era. Optimize for AI answers, not just blue links.',
    icon: 'Zap',
    details: [
      'Query intent mapping',
      'Answer snippet targeting',
      'ai.txt management',
      'Knowledge graph alignment',
    ],
  },
  {
    title: 'Enterprise Controls',
    description: 'Manage AI access to your content. Control what gets crawled, cited, and trained on.',
    icon: 'Shield',
    details: [
      'ai.txt + robots.txt sync',
      'Crawl budget optimization',
      'Content licensing controls',
      'Team permissions & audit log',
    ],
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            SEO rebuilt for the AI era
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            Traditional SEO optimizes for crawlers. RankAI optimizes for the
            AI agents that now answer your customers&apos; questions.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Bot;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
              >
                <Card className="h-full card-hover">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-brand text-white flex items-center justify-center shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-5 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 mt-2 rounded-full bg-primary" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
