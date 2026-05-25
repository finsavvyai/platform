import { motion } from 'framer-motion';
import { Shield, Brain, Lock, Zap, FileText, Users } from 'lucide-react';
import { Card } from './Card';
import { Feature } from '../types';

const iconMap: Record<string, React.ElementType> = { Shield, Zap, Brain, FileText, Lock, Users };

const features: Feature[] = [
    {
      title: 'Model Agnostic',
      description: 'One secure control plane for OpenAI, Anthropic, Gemini, Bedrock, and Azure OpenAI.',
      icon: 'Brain',
      details: ['Single base URL swap', 'No SDK lock-in', 'Prompt/response guardrails', 'Vendor-level policy controls', 'Provider failover ready']
    },
    {
      title: 'Automatic Data Protection',
      description: 'Sensitive fields are detected and redacted before they leave your environment.',
      icon: 'Shield',
      details: ['SSN, PHI, PCI, emails', 'Custom regex + policy rules', 'Context-aware masking', 'Low-latency edge checks', 'Human-readable explainability']
    },
    {
      title: 'Compliance by Default',
      description: 'Enforce policy templates for HIPAA, GDPR, FINRA, and internal security controls.',
      icon: 'FileText',
      details: ['Template-based enforcement', 'Configurable policy packs', 'Evidence exports', 'Audit-ready logs', 'Tenant-specific controls']
    },
    {
      title: 'Fast Onboarding',
      description: 'Deploy quickly with a productized setup flow for engineering and security teams.',
      icon: 'Zap',
      details: ['5-minute setup path', 'No infra migration required', 'Works with current pipelines', 'Guided test mode', 'Environment separation']
    },
    {
      title: 'Immutable Audit Trail',
      description: 'Every request and policy action is tracked for internal and external review.',
      icon: 'Lock',
      details: ['Traceable request chain', 'Tamper-aware logs', 'Policy decision history', 'Exportable reports', 'Compliance evidence packaging']
    },
    {
      title: 'Operational Governance',
      description: 'Manage access, usage, and policy scope across teams from one interface.',
      icon: 'Users',
      details: ['RBAC and org boundaries', 'Usage analytics', 'Alerting hooks', 'Per-team policy profiles', 'Security ownership workflows']
    }
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
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">Built for secure AI at scale</h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">A modern compliance layer designed for velocity, controls, and audit readiness.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = iconMap[feature.icon] || Shield;
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
                    <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="text-slate-600 mb-5 leading-relaxed">{feature.description}</p>
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
