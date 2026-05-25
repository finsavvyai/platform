import { motion } from 'framer-motion';
import { Bot, Search, BarChart3, Globe } from 'lucide-react';

const stats = [
  { icon: Bot, value: '4 AI Agents', label: 'Monitored' },
  { icon: Search, value: '10K+', label: 'Queries Analyzed' },
  { icon: BarChart3, value: '3.2x', label: 'Citation Lift' },
  { icon: Globe, value: '50+', label: 'Content Signals' },
];

const TrustBar = () => {
  return (
    <section className="py-8 border-t border-b border-slate-200/60" aria-label="Platform statistics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap justify-center gap-6 md:gap-12"
        >
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3 px-4 py-2">
                <Icon className="h-5 w-5 text-primary-500 flex-shrink-0" />
                <div className="text-left">
                  <div className="text-lg font-bold text-slate-900 leading-tight">{stat.value}</div>
                  <div className="text-xs text-slate-500 leading-tight">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBar;
