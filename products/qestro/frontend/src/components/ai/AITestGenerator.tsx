import React, { useState } from 'react';
import { aiTestingService } from '../../services/aiTestingService';
import type { TestGenerationResult } from '../../services/aiTestingService';
import './AITestGenerator.css';

interface AITestGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onTestGenerated?: (result: TestGenerationResult) => void;
}

export const AITestGenerator: React.FC<AITestGeneratorProps> = ({
    isOpen,
    onClose,
    onTestGenerated,
}) => {
    const [scenario, setScenario] = useState('');
    const [userStory, setUserStory] = useState('');
    const [platform, setPlatform] = useState<'web' | 'mobile' | 'api'>('web');
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<TestGenerationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        if (!scenario.trim()) {
            setError('Please describe what you want to test');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setResult(null);

        try {
            const response = await aiTestingService.generateTest({
                scenario: scenario.trim(),
                platform,
                userStory: userStory.trim() || undefined,
            });

            setResult(response);
            onTestGenerated?.(response);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to generate test');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (result?.testCode) {
            navigator.clipboard.writeText(result.testCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleReset = () => {
        setScenario('');
        setUserStory('');
        setResult(null);
        setError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="ai-generator-overlay" onClick={onClose}>
            <div className="ai-generator-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="ai-generator-header">
                    <div className="ai-generator-title">
                        <span className="ai-icon">✨</span>
                        <h2>AI Test Generator</h2>
                        <span className="ai-badge">Qestro AI</span>
                    </div>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

                {/* Content */}
                <div className="ai-generator-content">
                    {!result ? (
                        <>
                            {/* Platform Selector */}
                            <div className="platform-selector">
                                <label>Platform</label>
                                <div className="platform-options">
                                    <button
                                        className={`platform-option ${platform === 'web' ? 'active' : ''}`}
                                        onClick={() => setPlatform('web')}
                                    >
                                        <span className="platform-icon">🌐</span>
                                        <span>Web</span>
                                    </button>
                                    <button
                                        className={`platform-option ${platform === 'mobile' ? 'active' : ''}`}
                                        onClick={() => setPlatform('mobile')}
                                    >
                                        <span className="platform-icon">📱</span>
                                        <span>Mobile</span>
                                    </button>
                                    <button
                                        className={`platform-option ${platform === 'api' ? 'active' : ''}`}
                                        onClick={() => setPlatform('api')}
                                    >
                                        <span className="platform-icon">🔌</span>
                                        <span>API</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scenario Input */}
                            <div className="input-group">
                                <label htmlFor="scenario">
                                    What do you want to test?
                                    <span className="required">*</span>
                                </label>
                                <textarea
                                    id="scenario"
                                    value={scenario}
                                    onChange={(e) => setScenario(e.target.value)}
                                    placeholder="e.g., User clicks the login button, enters credentials, and gets redirected to the dashboard"
                                    rows={3}
                                />
                            </div>

                            {/* User Story Input (Optional) */}
                            <div className="input-group">
                                <label htmlFor="userStory">
                                    User Story (optional)
                                    <span className="optional">Adds context</span>
                                </label>
                                <textarea
                                    id="userStory"
                                    value={userStory}
                                    onChange={(e) => setUserStory(e.target.value)}
                                    placeholder="e.g., As a registered user, I want to log in so that I can access my account"
                                    rows={2}
                                />
                            </div>

                            {/* Error Display */}
                            {error && (
                                <div className="error-message">
                                    <span className="error-icon">⚠️</span>
                                    {error}
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                className={`generate-button ${isGenerating ? 'generating' : ''}`}
                                onClick={handleGenerate}
                                disabled={isGenerating || !scenario.trim()}
                            >
                                {isGenerating ? (
                                    <>
                                        <span className="spinner"></span>
                                        Generating with AI...
                                    </>
                                ) : (
                                    <>
                                        <span className="magic-icon">🪄</span>
                                        Generate Test
                                    </>
                                )}
                            </button>

                            {/* Tips */}
                            <div className="tips-section">
                                <h4>💡 Tips for better results:</h4>
                                <ul>
                                    <li>Be specific about user actions (click, type, scroll)</li>
                                    <li>Include the expected outcome</li>
                                    <li>Mention specific elements if known</li>
                                </ul>
                            </div>
                        </>
                    ) : (
                        /* Result View */
                        <div className="result-view">
                            {/* Success Header */}
                            <div className="result-header">
                                <span className="success-icon">✅</span>
                                <div className="result-meta">
                                    <h3>Test Generated Successfully!</h3>
                                    <div className="result-stats">
                                        <span className="stat">
                                            <strong>Confidence:</strong>
                                            <span className={`confidence ${result.confidence >= 0.8 ? 'high' : result.confidence >= 0.5 ? 'medium' : 'low'}`}>
                                                {Math.round(result.confidence * 100)}%
                                            </span>
                                        </span>
                                        <span className="stat">
                                            <strong>Coverage:</strong> ~{result.estimatedCoverage}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Code Preview */}
                            <div className="code-preview">
                                <div className="code-header">
                                    <span className="code-label">
                                        {platform === 'web' ? 'Playwright Test' :
                                            platform === 'mobile' ? 'Maestro Flow' : 'API Test'}
                                    </span>
                                    <button
                                        className={`copy-button ${copied ? 'copied' : ''}`}
                                        onClick={handleCopy}
                                    >
                                        {copied ? '✓ Copied!' : '📋 Copy'}
                                    </button>
                                </div>
                                <pre className="code-block">
                                    <code>{result.testCode}</code>
                                </pre>
                            </div>

                            {/* Suggestions */}
                            {result.suggestions.length > 0 && (
                                <div className="suggestions-section">
                                    <h4>💡 Suggestions to improve:</h4>
                                    <ul>
                                        {result.suggestions.map((suggestion, index) => (
                                            <li key={index}>{suggestion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="result-actions">
                                <button className="secondary-button" onClick={handleReset}>
                                    ← Generate Another
                                </button>
                                <button className="primary-button" onClick={onClose}>
                                    Use This Test
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AITestGenerator;
