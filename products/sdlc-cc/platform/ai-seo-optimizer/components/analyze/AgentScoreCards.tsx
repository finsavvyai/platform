import { motion } from 'framer-motion';
import { ScoreRing } from '../ScoreRing';
import type { AgentScore } from '../../lib/types';

interface AgentScoreCardsProps {
  scores: AgentScore[];
}

const likelihoodColors = {
  high: 'bg-emerald-50 text-score-high border-emerald-100',
  medium: 'bg-amber-50 text-score-medium border-amber-100',
  low: 'bg-red-50 text-score-low border-red-100',
};

const AgentScoreCards = ({ scores }: AgentScoreCardsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {scores.map((agent, i) => (
        <motion.div
          key={agent.agent}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="metric-card flex flex-col items-center py-5"
        >
          <ScoreRing score={agent.score} size={72} />
          <span className="text-sm font-semibold text-slate-800 mt-3">
            {agent.agent}
          </span>
          <span className={`text-[10px] font-medium uppercase tracking-wide mt-1 px-2 py-0.5 rounded-md border ${likelihoodColors[agent.citationLikelihood]}`}>
            {agent.citationLikelihood} citation
          </span>
        </motion.div>
      ))}
    </div>
  );
};

export default AgentScoreCards;
