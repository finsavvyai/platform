import React, { useState, useCallback } from 'react';
import { useNlpQuery } from '../../hooks/useNlpQuery';
import { NLP_DIALECTS } from '../../types/api';
import type { NlpDialect } from '../../types/api';
import { cn } from '@/lib/utils';

interface NlpQueryBarProps {
    schema?: string;
    defaultDialect?: NlpDialect;
    onSqlGenerated: (sql: string) => void;
}

export function NlpQueryBar({ schema, defaultDialect = 'postgresql', onSqlGenerated }: NlpQueryBarProps) {
    const [question, setQuestion] = useState('');
    const [dialect, setDialect] = useState<NlpDialect>(defaultDialect);
    const nlpQuery = useNlpQuery();

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!question.trim()) return;

            nlpQuery.mutate(
                { question: question.trim(), schema, dialect },
                {
                    onSuccess: (data) => {
                        if (data.sql) {
                            onSqlGenerated(data.sql);
                        }
                    },
                }
            );
        },
        [question, schema, dialect, nlpQuery, onSqlGenerated]
    );

    return (
        <form onSubmit={handleSubmit} className="border-b border-border/70 bg-card/35">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                <span className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-black text-warning">
                    AI
                </span>

                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask in plain English: e.g. 'Show top 10 customers by revenue'"
                    className={cn(
                        'min-w-0 flex-1 rounded-xl border border-border/70 bg-background/35 px-3 py-2 text-sm text-foreground',
                        'placeholder:text-muted-foreground/60',
                        'outline-none transition-colors focus:border-primary/60'
                    )}
                    aria-label="Natural language query"
                />

                <select
                    value={dialect}
                    onChange={(e) => setDialect(e.target.value as NlpDialect)}
                    aria-label="SQL dialect"
                    className={cn(
                        'rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-xs font-semibold text-muted-foreground',
                        'outline-none cursor-pointer',
                        'hover:border-primary/50 transition-colors'
                    )}
                >
                    {NLP_DIALECTS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>

                <button
                    type="submit"
                    disabled={nlpQuery.isPending || !question.trim()}
                    className={cn(
                        'premium-button rounded-xl px-4 py-2 text-xs font-black',
                        'transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                >
                    {nlpQuery.isPending ? 'Generating...' : 'Generate SQL'}
                </button>
            </div>

            {nlpQuery.data && (
                <div className="flex items-center gap-2 px-4 pb-3 text-xs">
                    <span className="text-success">
                        Confidence: {Math.round(nlpQuery.data.confidence * 100)}%
                    </span>
                    {nlpQuery.data.explanation && (
                        <span className="text-muted-foreground">
                            {nlpQuery.data.explanation}
                        </span>
                    )}
                </div>
            )}

            {nlpQuery.error && (
                <div className="px-4 pb-3 text-xs text-destructive">
                    {nlpQuery.error.message}
                </div>
            )}
        </form>
    );
}
