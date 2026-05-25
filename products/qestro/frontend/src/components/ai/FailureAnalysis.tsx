import React, { useCallback, useState } from 'react';
import { aiTestingService } from '../../services/aiTestingService';
import type { FailureAnalysisResult, SelfHealingResult } from '../../services/aiTestingService';
import './FailureAnalysis.css';

interface FailureAnalysisProps {
    testName: string;
    error: string;
    stackTrace?: string;
    testCode: string;
    screenshots?: string[];
    isOpen: boolean;
    onClose: () => void;
    onApplyFix?: (fixedCode: string) => void;
}

export const FailureAnalysis: React.FC<FailureAnalysisProps> = ({
    testName,
    error,
    stackTrace,
    testCode,
    screenshots,
    isOpen,
    onClose,
    onApplyFix,
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<FailureAnalysisResult | null>(null);
    const [healing, setHealing] = useState<SelfHealingResult | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'healing'>('analysis');
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const handleAnalyze = useCallback(async () => {
        setIsAnalyzing(true);
        setAnalysisError(null);

        try {
            // Run both analysis and healing in parallel
            const [analysisResult, healingResult] = await Promise.all([
                aiTestingService.analyzeFailure({
                    testName,
                    error,
                    stackTrace,
                    testCode,
                    screenshots,
                }),
                aiTestingService.healTest({
                    testCode,
                    errorLog: error,
                    stackTrace,
                    screenshots,
                }),
            ]);

            setAnalysis(analysisResult);
            setHealing(healingResult);
        } catch (err: unknown) {
            setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setIsAnalyzing(false);
        }
    }, [error, screenshots, stackTrace, testCode, testName]);

    const getCategoryIcon = (category: string): string => {
        const icons: Record<string, string> = {
            timing: '⏱️',
            locator: '🎯',
            assertion: '✅',
            network: '🌐',
            data: '💾',
            environment: '🔧',
        };
        return icons[category] || '❓';
    };

    const getCategoryLabel = (category: string): string => {
        const labels: Record<string, string> = {
            timing: 'Timing Issue',
            locator: 'Locator Problem',
            assertion: 'Assertion Failure',
            network: 'Network Error',
            data: 'Data Issue',
            environment: 'Environment Problem',
        };
        return labels[category] || 'Unknown';
    };

    const getActionIcon = (type: string): string => {
        const icons: Record<string, string> = {
            update_locator: '🎯',
            add_wait: '⏳',
            retry_logic: '🔄',
            assertion_fix: '✅',
        };
        return icons[type] || '🔧';
    };

    React.useEffect(() => {
        if (isOpen && !analysis && !isAnalyzing) {
            void handleAnalyze();
        }
    }, [analysis, handleAnalyze, isAnalyzing, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="failure-overlay" onClick={onClose}>
            <div className="failure-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="failure-header">
                    <div className="failure-title">
                        <span className="failure-icon">🔍</span>
                        <div>
                            <h2>AI Failure Analysis</h2>
                            <p className="test-name">{testName}</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Error Summary */}
                <div className="error-summary">
                    <span className="error-label">Error:</span>
                    <code className="error-text">{error}</code>
                </div>

                {/* Loading State */}
                {isAnalyzing && (
                    <div className="analysis-loading">
                        <div className="brain-animation">
                            <span className="brain">🧠</span>
                            <div className="pulse-ring"></div>
                        </div>
                        <p>AI is analyzing the failure...</p>
                        <span className="loading-hint">Checking patterns, locators, and timing</span>
                    </div>
                )}

                {/* Error State */}
                {analysisError && (
                    <div className="analysis-error">
                        <span>⚠️</span>
                        <p>{analysisError}</p>
                        <button onClick={handleAnalyze}>Try Again</button>
                    </div>
                )}

                {/* Results */}
                {analysis && !isAnalyzing && (
                    <>
                        {/* Tabs */}
                        <div className="analysis-tabs">
                            <button
                                className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
                                onClick={() => setActiveTab('analysis')}
                            >
                                📊 Root Cause
                            </button>
                            <button
                                className={`tab ${activeTab === 'healing' ? 'active' : ''}`}
                                onClick={() => setActiveTab('healing')}
                            >
                                🩹 Self-Healing
                                {healing?.success && <span className="tab-badge">Fix Available</span>}
                            </button>
                        </div>

                        {/* Analysis Tab */}
                        {activeTab === 'analysis' && (
                            <div className="tab-content analysis-content">
                                {/* Category Badge */}
                                <div className="category-badge" data-category={analysis.category}>
                                    <span className="category-icon">{getCategoryIcon(analysis.category)}</span>
                                    <span className="category-text">{getCategoryLabel(analysis.category)}</span>
                                    <span className="confidence-badge">
                                        {Math.round(analysis.confidence * 100)}% confident
                                    </span>
                                </div>

                                {/* Root Cause */}
                                <div className="analysis-section">
                                    <h3>🔍 Root Cause</h3>
                                    <p className="root-cause-text">{analysis.rootCause}</p>
                                </div>

                                {/* Suggested Fix */}
                                <div className="analysis-section">
                                    <h3>💡 Suggested Fix</h3>
                                    <div className="suggested-fix">
                                        <code>{analysis.suggestedFix}</code>
                                    </div>
                                </div>

                                {/* Prevention Steps */}
                                {analysis.preventionSteps.length > 0 && (
                                    <div className="analysis-section">
                                        <h3>🛡️ Prevention Steps</h3>
                                        <ul className="prevention-list">
                                            {analysis.preventionSteps.map((step, index) => (
                                                <li key={index}>
                                                    <span className="step-number">{index + 1}</span>
                                                    {step}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Healing Tab */}
                        {activeTab === 'healing' && healing && (
                            <div className="tab-content healing-content">
                                {healing.success && healing.fixedTest ? (
                                    <>
                                        {/* Diagnosis */}
                                        <div className="healing-diagnosis">
                                            <span className="diagnosis-icon">🩺</span>
                                            <p>{healing.diagnosis}</p>
                                        </div>

                                        {/* Actions Taken */}
                                        {healing.actions.length > 0 && (
                                            <div className="healing-actions">
                                                <h4>Actions Applied:</h4>
                                                {healing.actions.map((action, index) => (
                                                    <div key={index} className="action-item">
                                                        <span className="action-icon">{getActionIcon(action.type)}</span>
                                                        <div className="action-info">
                                                            <span className="action-type">{action.type.replace('_', ' ')}</span>
                                                            <p className="action-desc">{action.description}</p>
                                                            <code className="action-code">{action.code}</code>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Fixed Code Preview */}
                                        <div className="fixed-code-section">
                                            <div className="code-header">
                                                <h4>✨ Healed Test Code</h4>
                                                <span className="confidence-tag">
                                                    {Math.round(healing.confidence * 100)}% confidence
                                                </span>
                                            </div>
                                            <pre className="fixed-code">
                                                <code>{healing.fixedTest}</code>
                                            </pre>
                                        </div>

                                        {/* Apply Button */}
                                        <button
                                            className="apply-fix-button"
                                            onClick={() => onApplyFix?.(healing.fixedTest!)}
                                        >
                                            <span>🚀</span>
                                            Apply This Fix
                                        </button>
                                    </>
                                ) : (
                                    <div className="no-healing">
                                        <span className="no-healing-icon">😔</span>
                                        <h4>Unable to Auto-Heal</h4>
                                        <p>This failure requires manual investigation.
                                            Check the Root Cause tab for guidance.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default FailureAnalysis;
