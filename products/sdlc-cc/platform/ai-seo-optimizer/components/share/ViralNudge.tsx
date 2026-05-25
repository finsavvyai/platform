import { motion } from 'framer-motion';
import { ArrowRight, Trophy, Users } from 'lucide-react';

interface ViralNudgeProps {
  score: number;
}

const ViralNudge = ({ score }: ViralNudgeProps) => {
  const nudges = getNudges(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="rounded-2xl border border-primary-100 bg-primary-50/50 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
          {score >= 60 ? (
            <Trophy className="h-4.5 w-4.5 text-primary-600" />
          ) : (
            <Users className="h-4.5 w-4.5 text-primary-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-900 mb-1">
            {nudges.headline}
          </p>
          <p className="text-xs text-primary-700 leading-relaxed">
            {nudges.body}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

function getNudges(score: number) {
  if (score >= 75) {
    return {
      headline: 'You\'re in the top 12% — flex it.',
      body: 'Share your score and make your competitors question their content strategy. The AI era rewards those who move first.',
    };
  }
  if (score >= 50) {
    return {
      headline: 'Share this before your competitor does.',
      body: 'Your score is better than 60% of sites. Post it, tag a rival, and watch the engagement roll in. Nothing goes viral like friendly competition.',
    };
  }
  return {
    headline: 'Bad scores go MORE viral than good ones.',
    body: 'Seriously — people love a good roast. Share your score, get the sympathy engagement, and come back once you\'ve optimized. Redemption arcs get clicks.',
  };
}

export default ViralNudge;
