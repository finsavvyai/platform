import { motion } from 'framer-motion';
import { Shield, Brain, Lock, Zap, Database, FileText, Radar, Users } from 'lucide-react';
import { Card } from './Card';
import { Feature } from '../types';

const Features = () => {
  const features: Feature[] = [
    {
      title: 'Model-Agnostic Security Layer',
      description: 'Keep your current AI stack and insert OpenSyber as a control plane in front of every call.',
      icon: 'Brain',
      details: [
        'Works with OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI',
        'Single base URL swap for fast adoption',
        'Per-team policy routing with tenant isolation',
        'No model lock-in and no migration project',
        'Safe experimentation for product and engineering teams'
      ]
    },
    {
      title: 'Real-Time Data Loss Prevention',
      description: 'Detect and neutralize sensitive data in transit before prompts ever leave your perimeter.',
      icon: 'Shield',
      details: [
        'Automatic PII and PHI detection across prompt payloads',
        'Masking, hashing, and tokenization strategies',
        'Jurisdiction-aware routing and policy bundles',
        'Custom pattern registry for enterprise edge cases',
        'Incident annotations for compliance and forensics'
      ]
    },
    {
      title: 'Evidence-Grade Audit Trails',
      description: 'Every decision is logged, signed, and replayable for audits, investigations, and customer trust.',
      icon: 'FileText',
      details: [
        'Tamper-evident event chains and export snapshots',
        'Full prompt and response governance timeline',
        'Control mapping for HIPAA, GDPR, SOC2, PCI-DSS',
        'One-click evidence package generation',
        'Stream to your SIEM and governance tooling'
      ]
    },
    {
      title: 'Policy Copilot and Guardrails',
      description: 'Move from static policy docs to dynamic runtime controls that adapt as threats evolve.',
      icon: 'Radar',
      details: [
        'Runtime policy checks with low-latency enforcement',
        'Versioned policy rollouts with rollback safety',
        'Drift detection across teams and environments',
        'Prompt injection and jailbreak pattern blocking',
        'Human-in-the-loop approvals for critical actions'
      ]
    },
    {
      title: 'Zero-Trust Security Fabric',
      description: 'OpenSyber applies identity, encryption, and authorization controls to every AI interaction.',
      icon: 'Lock',
      details: [
        'End-to-end request signing and encrypted transit',
        'Tenant-bound keys and scoped access controls',
        'SAML, SSO, and role policy integration',
        'Regional controls and residency boundaries',
        'Built for regulated enterprise environments'
      ]
    },
    {
      title: 'Scale for Real Production',
      description: 'Built for high-volume teams shipping AI into customer-facing and internal workflows.',
      icon: 'Users',
      details: [
        'High-throughput architecture with low overhead',
        'Load-aware policy engines and queueing',
        'Operational dashboards and anomaly alerts',
        'Dedicated onboarding and architecture support',
        'SLA-backed reliability for mission-critical paths'
      ]
    }
  ];

  const iconMap: { [key: string]: any } = {
    Shield,
    Zap,
    Brain,
    FileText,
    Lock,
    Database,
    Radar,
    Users
  };

  return (
    <section id="features" className="py-20 bg-[#060a15]/70">
      <div id="security" className="relative -top-24" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="eyebrow mb-4">Security Fabric for Aggressive AI Roadmaps</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Built for teams that move fast and get audited harder
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            OpenSyber turns governance into an engine for growth, not a blocker. Ship new AI features
            on your timeline while keeping legal, compliance, and security in lockstep.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Shield;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.08 }}
              >
                <Card className="h-full card-hover border border-slate-700/60">
                  <div className="flex items-center mb-4">
                    <div className="flex items-center justify-center w-12 h-12 bg-sky-900/30 rounded-lg mr-4 border border-sky-400/20">
                      <Icon className="h-6 w-6 text-sdlc-accent" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {feature.title}
                    </h3>
                  </div>

                  <p className="text-slate-300 mb-6 leading-relaxed">
                    {feature.description}
                  </p>

                  <ul className="space-y-2">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start">
                        <div className="w-2 h-2 bg-sdlc-blue rounded-full mt-2 mr-3 flex-shrink-0" />
                        <span className="text-slate-400 text-sm">{detail}</span>
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
