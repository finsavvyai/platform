import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Mail } from 'lucide-react';

const Waitlist = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitted(true);
  };

  return (
    <section id="waitlist" className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute bottom-0 left-[20%] w-80 h-80 rounded-full bg-primary-200 blur-[100px]" />
        <div className="absolute top-10 right-[10%] w-96 h-96 rounded-full bg-accent-200 blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Ready to rank in the AI era?
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10">
            Join the waitlist. Be the first to get your AI Visibility Score
            and start optimizing before your competitors do.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          {submitted ? (
            <SuccessState />
          ) : (
            <WaitlistForm
              email={email}
              error={error}
              onEmailChange={setEmail}
              onSubmit={handleSubmit}
            />
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-xs text-slate-400 mt-6"
        >
          No spam. Unsubscribe anytime. We respect your inbox.
        </motion.p>
      </div>
    </section>
  );
};

interface WaitlistFormProps {
  email: string;
  error: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function WaitlistForm({ email, error, onEmailChange, onSubmit }: WaitlistFormProps) {
  return (
    <form onSubmit={onSubmit} className="max-w-md mx-auto" noValidate>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@company.com"
            aria-label="Email address"
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:outline-none transition-all"
          />
        </div>
        <motion.button
          type="submit"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="button-primary px-6 py-3.5 gap-2 flex-shrink-0"
        >
          Join
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-left">{error}</p>
      )}
    </form>
  );
}

function SuccessState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-2xl p-8 max-w-md mx-auto"
    >
      <CheckCircle className="h-12 w-12 text-score-high mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        You&apos;re on the list
      </h3>
      <p className="text-slate-600">
        We&apos;ll send your early access invite soon.
        Check your inbox for a confirmation.
      </p>
    </motion.div>
  );
}

export default Waitlist;
