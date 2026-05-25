import { motion } from 'framer-motion';
import { Shield, Lock, FileCheck, Scale } from 'lucide-react';

const badges = [
  { label: 'SOC 2 Type II', sublabel: 'Architecture', icon: Shield },
  { label: 'HIPAA', sublabel: 'Aligned', icon: Lock },
  { label: 'GDPR', sublabel: 'Ready', icon: FileCheck },
  { label: 'FINRA', sublabel: 'Controls', icon: Scale },
];

const TrustBar = () => {
  return (
    <section className="py-8 border-t border-b border-slate-200/60" aria-label="Compliance certifications">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mb-5">
            Built for regulated industries
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {badges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white/60"
                >
                  <Icon className="h-5 w-5 text-cta flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-900 leading-tight">{badge.label}</div>
                    <div className="text-[11px] text-slate-500 leading-tight">{badge.sublabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBar;
