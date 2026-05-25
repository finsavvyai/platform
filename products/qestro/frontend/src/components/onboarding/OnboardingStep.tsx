import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../atoms/Card/Card';

interface OnboardingStepProps {
  stepNumber: number;
  title: string;
  description: string;
  children: ReactNode;
}

const OnboardingStep = ({
  stepNumber,
  title,
  description,
  children
}: OnboardingStepProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="p-8 border-blue-700/50 bg-gradient-to-br from-slate-800 to-slate-900">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
              {stepNumber}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{title}</h2>
              <p className="text-slate-400 text-sm">{description}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-slate-700 mb-8" />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {children}
        </motion.div>
      </Card>
    </motion.div>
  );
};

export default OnboardingStep;
