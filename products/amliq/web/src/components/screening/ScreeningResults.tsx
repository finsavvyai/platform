import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScreeningResultCard } from './ScreeningResultCard';

interface Result {
  name: string;
  confidence: number;
}

interface ResultsProps {
  results: Result[];
  processingTime?: number;
}

export function ScreeningResults({ results, processingTime }: ResultsProps) {
  const { t } = useTranslation('screening');

  return (
    <div className="mt-xxl">
      <div className="flex items-center justify-between mb-lg">
        <h2 className="sf-headline text-xl">{t('results.title')}</h2>
        {processingTime !== undefined && (
          <span className="badge-blue">{processingTime}ms</span>
        )}
      </div>
      <div className="space-y-md">
        {results.map((result, idx) => (
          <ScreeningResultCard key={idx} result={result} index={idx} />
        ))}
      </div>
    </div>
  );
}
