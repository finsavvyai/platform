import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function AlphaDisclaimer() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-warning/10 border-l-4 border-warning p-4 mb-8 rounded-r-lg"
    >
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-warning mr-3 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">
            Alpha Product Notice
          </h3>
          <p className="text-sm text-slate-600">
            SDLC.ai is currently in alpha. Not recommended for production workloads handling sensitive data.
            All compliance certifications (SOC 2, HIPAA BAA) are planned for Q2-Q3 2026.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
