import { motion } from 'framer-motion';
import { ArrowRight, Shield, Lock, Zap } from 'lucide-react';
import { Button } from './Button';
import HeroIllustration from './HeroIllustration';

const Hero = () => {
  const metrics = [
    { label: 'PII Classes', value: '12+' },
    { label: 'Redaction Latency', value: '<50ms' },
    { label: 'Audit Coverage', value: '100%' },
  ];

  return (
    <section className="hero-gradient pt-32 pb-20 md:pt-36 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-slate-700">Apple-grade UX. Enterprise-grade AI compliance.</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-950 mb-6 leading-tight">
              Protect AI workflows
              <span className="gradient-text block">without slowing teams down</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mb-8 leading-relaxed">
              SDLC inserts a secure compliance layer between your team and ChatGPT, Claude, and Gemini,
              automatically redacting sensitive data while preserving development velocity.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <div className="trust-badge"><Zap className="h-3.5 w-3.5" /> No workflow rewrite</div>
              <div className="trust-badge"><Lock className="h-3.5 w-3.5" /> Built-in evidence trail</div>
              <div className="trust-badge"><Shield className="h-3.5 w-3.5" /> HIPAA/GDPR/FINRA aligned</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button href="/sign-up" variant="primary" size="lg">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button href="#demo" variant="secondary" size="lg">
                Request Demo
              </Button>
              <Button href="#pricing" variant="secondary" size="lg">
                View plans
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="glass-panel rounded-3xl p-6 md:p-8">
              <HeroIllustration />
              <div className="grid grid-cols-3 gap-3 mt-6">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl bg-white/85 border border-white/70 px-3 py-3 text-center">
                    <div className="text-lg md:text-xl font-semibold text-slate-900">{metric.value}</div>
                    <div className="text-[11px] md:text-xs text-slate-600">{metric.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
