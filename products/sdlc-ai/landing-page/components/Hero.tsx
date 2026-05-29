import { motion } from 'framer-motion';
import { ArrowRight, Shield, Brain, Lock, Activity, Flame, Sparkles } from 'lucide-react';
import { Button } from './Button';

const Hero = () => {
  const metrics = [
    { label: 'Policy Decisions', value: '42M+', description: 'per day across production tenants' },
    { label: 'Median Latency', value: '38ms', description: 'policy + redaction + routing' },
    { label: 'Leak Attempts Blocked', value: '18.4M', description: 'detected and neutralized monthly' },
  ];

  const threatEvents = [
    { name: 'PII Leak Blocked', status: 'resolved', tenant: 'Fintech-EU', latency: '34ms' },
    { name: 'Policy Drift Alert', status: 'reviewing', tenant: 'HealthOps-US', latency: '41ms' },
    { name: 'Prompt Injection Trapped', status: 'resolved', tenant: 'Legal-Cloud', latency: '29ms' },
    { name: 'Audit Snapshot Signed', status: 'synced', tenant: 'Global-Retail', latency: '22ms' },
  ];

  return (
    <section className="hero-gradient pt-24 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="eyebrow mb-6"
            >
              <Flame className="h-4 w-4 mr-2 text-orange-200" />
              OpenSyber is live in high-risk AI production stacks
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold text-white mb-6"
            >
              Move Fast with AI.
              <span className="gradient-text block">Break Nothing in Compliance.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-slate-300 mb-8 leading-relaxed"
            >
              OpenSyber is your runtime policy firewall across model calls, prompt traffic,
              and audit evidence so security never blocks product velocity.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-4 mb-8"
            >
              <div className="flex items-center text-slate-300">
                <Lock className="h-5 w-5 text-green-400 mr-2" />
                <span>Real-time DLP and prompt shielding</span>
              </div>
              <div className="flex items-center text-slate-300">
                <Brain className="h-5 w-5 text-sdlc-blue mr-2" />
                <span>OpenAI, Anthropic, Gemini, Bedrock</span>
              </div>
              <div className="flex items-center text-slate-300">
                <Shield className="h-5 w-5 text-sdlc-accent mr-2" />
                <span>HIPAA, GDPR, SOC2, PCI traceability</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button href="../web-app/onboarding/" variant="primary" size="lg">
                Start Secure Pilot
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button href="#demo" variant="secondary" size="lg">
                Watch Threat Replay
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative panel-glass rounded-2xl p-7 border border-sky-400/20">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-slate-400">Live Policy Stream</p>
                  <h3 className="text-white font-semibold text-lg">Threat + Compliance Feed</h3>
                </div>
                <div className="mono-chip flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-green-300" />
                  Online
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {threatEvents.map((event, index) => (
                  <motion.div
                    key={event.name}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.12 }}
                    className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-slate-100">{event.name}</p>
                      <span className="mono-chip">{event.latency}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{event.tenant}</span>
                      <span className="capitalize">{event.status}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {metrics.map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 + index * 0.1 }}
                    className="rounded-lg border border-sky-400/20 bg-slate-950/50 p-3 text-center"
                  >
                    <Sparkles className="h-4 w-4 text-sdlc-accent mx-auto mb-2" />
                    <div className="text-xl font-bold text-white">{metric.value}</div>
                    <div className="text-xs text-slate-300 mt-1">{metric.label}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{metric.description}</div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="absolute -top-16 -right-16 w-40 h-40 bg-sdlc-blue/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-14 -left-14 w-40 h-40 bg-sdlc-accent/20 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
