export interface GLMStep {
    id: string;
    type: 'reasoning' | 'context' | 'tool' | 'output';
    content: string;
    confidence: number;
    tokens: number;
    timestamp: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface InvestorDemoState {
    isActive: boolean;
    currentSteps: GLMStep[];
    metrics: {
        tps: number; // Tokens per second
        cost: number;
        latency: number;
    };
}

// Pre-canned "Impressive" scenarios for demos
const SCENARIOS = [
    {
        name: "Analyze Q3 Financials & Predict Q4",
        steps: [
            { type: 'context', content: 'Loading 10k Filings (AAPL, MSFT, GOOGL)...', confidence: 0.99, tokens: 450 },
            { type: 'reasoning', content: 'Identifying cross-sector correlation in Cloud Revenue growth...', confidence: 0.89, tokens: 120 },
            { type: 'tool', content: 'Running Python: `pandas.DataFrame.corr()`', confidence: 0.95, tokens: 60 },
            { type: 'reasoning', content: 'Detected anomaly in hardware sales cyclicality. Adjusting forecast model to ARIMA(1,1,1).', confidence: 0.92, tokens: 210 },
            { type: 'output', content: 'Q4 Projection: +12% YoY Growth with 94% Confidence Interval.', confidence: 0.94, tokens: 80 },
        ]
    },
    {
        name: "Refactor Legacy Codebase to Rust",
        steps: [
            { type: 'context', content: 'Reading src/backend/ (142 files)...', confidence: 0.98, tokens: 1200 },
            { type: 'reasoning', content: 'Mapping memory safety violations in current C++ implementation...', confidence: 0.85, tokens: 340 },
            { type: 'tool', content: 'AST Parser: Extracting dependency graph extracted', confidence: 0.99, tokens: 150 },
            { type: 'reasoning', content: 'Generating borrow checker compliant data structures for `UserSession`...', confidence: 0.91, tokens: 560 },
            { type: 'output', content: 'Generated 45 Rust modules. Coverage: 98%. Memory footprint reduced by 40%.', confidence: 0.97, tokens: 200 },
        ]
    }
];

export const generateMockStep = (scenarioIndex: number, stepIndex: number): GLMStep | null => {
    const scenario = SCENARIOS[scenarioIndex % SCENARIOS.length];
    if (stepIndex >= scenario.steps.length) return null;

    const step = scenario.steps[stepIndex];
    return {
        id: `step-${Date.now()}-${stepIndex}`,
        type: step.type as GLMStep['type'],
        content: step.content,
        confidence: step.confidence,
        tokens: step.tokens,
        timestamp: Date.now(),
        status: 'processing'
    };
};

export const getRandomMetrics = () => ({
    tps: Math.floor(Math.random() * (280 - 140 + 1) + 140),
    cost: Number((Math.random() * (0.05 - 0.001) + 0.001).toFixed(4)),
    latency: Math.floor(Math.random() * (120 - 45 + 1) + 45)
});
