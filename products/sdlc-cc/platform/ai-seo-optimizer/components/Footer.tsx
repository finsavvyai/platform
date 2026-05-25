import { Sparkles } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-3xl p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-brand text-white flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-lg font-semibold text-slate-900">RankAI</span>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">
                The AI-era SEO platform. Optimize your content for
                ChatGPT, Perplexity, Gemini, and every AI agent
                that answers questions using your data.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="#features" className="hover:text-slate-900 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a></li>
                <li><a href="#dashboard" className="hover:text-slate-900 transition-colors">Dashboard</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li><a href="mailto:hello@rankai.io" className="hover:text-slate-900 transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-slate-900 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 mt-8 pt-6 text-sm text-slate-500">
            2026 RankAI. All rights reserved. A product by SDLC.ai
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
