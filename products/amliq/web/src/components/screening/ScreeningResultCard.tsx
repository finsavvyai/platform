import React from 'react';
import { useTranslation } from 'react-i18next';
import { CircularConfidence } from './CircularConfidence';

interface Result {
  name: string;
  confidence: number;
}

interface Props {
  result: Result;
  index: number;
}

export function ScreeningResultCard({ result, index }: Props) {
  const { t } = useTranslation('screening');
  const delay = `${index * 80}ms`;

  return (
    <div
      className="card-vibrancy p-lg flex items-center gap-xl animate-fade-in"
      style={{ animationDelay: delay }}
    >
      <CircularConfidence score={result.confidence} />
      <div className="flex-1 min-w-0">
        <h4 className="sf-headline truncate">{result.name}</h4>
        <p className="sf-caption">{t('results.match_found')}</p>
        <ConfidenceBar score={result.confidence} />
      </div>
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'from-apple-red to-apple-orange'
    : score >= 60 ? 'from-apple-orange to-apple-yellow'
    : 'from-apple-green to-[#C9A96E]';

  return (
    <div className="mt-md h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}
