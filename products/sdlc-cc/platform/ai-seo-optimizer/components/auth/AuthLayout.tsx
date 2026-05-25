import { motion } from 'framer-motion';
import { Sparkles, Shield, BarChart3 } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex">
      <LeftPanel />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
};

function LeftPanel() {
  const features = [
    { icon: BarChart3, text: 'AI Visibility Score across ChatGPT, Perplexity, Claude & Gemini' },
    { icon: Shield, text: 'Real-time citation tracking and competitor benchmarking' },
    { icon: Sparkles, text: 'AI-powered content optimization recommendations' },
  ];

  return (
    <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-accent-400 blur-[80px]" />
        <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-primary-400 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14">
        <div>
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm text-white flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-lg font-semibold text-white">RankAI</span>
          </a>
        </div>

        <div>
          <h2 className="text-2xl xl:text-3xl font-bold text-white leading-tight mb-3">
            SEO built for the AI era
          </h2>
          <p className="text-primary-200 text-sm leading-relaxed mb-8">
            Join teams already optimizing their content for AI agent discovery.
          </p>

          <div className="space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-primary-200" />
                  </div>
                  <span className="text-sm text-primary-100 leading-relaxed">
                    {f.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-white/15 border-2 border-primary-800 flex items-center justify-center text-[10px] font-medium text-primary-200">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <span className="text-xs text-primary-300">
            2,400+ marketers on the waitlist
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
