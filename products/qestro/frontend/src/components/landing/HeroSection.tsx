import { motion } from 'framer-motion';
import { ChevronRight, Zap } from 'lucide-react';
import { Button, Badge } from '../atoms';

interface HeroSectionProps {
  onStartFree: () => void;
}

const HeroSection = ({ onStartFree }: HeroSectionProps) => {
  return (
    <>
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-xl">Qestro</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              document
                .querySelector('#pricing')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            className="text-slate-400 hover:text-white transition"
          >
            Pricing
          </button>
          <Button variant="outline">Sign In</Button>
          <Button onClick={onStartFree}>Start Free</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 py-20 md:px-12 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <Badge className="mb-4 inline-block">Trusted by 500+ teams</Badge>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
              Write Tests Once. Run Everywhere.
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              AI-powered testing platform. Browser, Mobile, API. Self-healing assertions. Reduce
              maintenance by 80%.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button size="lg" onClick={onStartFree} className="gap-2">
                Start Free <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </div>

            {/* Animated gradient background */}
            <div className="absolute inset-0 -z-10 opacity-20">
              <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-purple-500 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
