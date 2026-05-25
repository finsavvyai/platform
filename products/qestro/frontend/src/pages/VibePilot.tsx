import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clipboard,
  GitBranch,
  Github,
  Loader2,
  Lock,
  Sparkles
} from 'lucide-react';
import { Card } from '../components/atoms';
import { motion } from 'framer-motion';
import { TestGenerationForm } from '../components/vibe-pilot/TestGenerationForm';
import { GeneratedCodeView } from '../components/vibe-pilot/GeneratedCodeView';
import { api } from '../lib/api';

interface GeneratedTest {
  id: string;
  code: string;
  testType: 'E2E' | 'API' | 'Visual';
  framework: string;
  confidence: number;
}

type RepositoryPersona = 'developer' | 'product' | 'business' | 'qa';

interface RepositoryScenario {
  id: string;
  name: string;
  type: string;
  priority: string;
  persona: string;
  rationale: string;
  sourcePaths: string[];
  steps: string[];
  selected: boolean;
}

interface RepositoryScanResult {
  repository: {
    url: string;
    fullName: string;
    branch: string;
  };
  connection: {
    provider: string;
    status: string;
    liveIndexing: boolean;
    indexedFiles?: Array<{ path: string; size: number }>;
    treeSample?: string[];
    error?: string;
  };
  billing: {
    feature: string;
    planId: string;
    minimumPlan: string;
    usage: {
      type: string;
      used: number;
      limit: number;
      remaining: number;
    };
  };
  message: string;
  prompt: string;
  scenarios: RepositoryScenario[];
}

interface FeatureAccess {
  feature: string;
  name: string;
  planId: string;
  minimumPlan: string;
  hasAccess: boolean;
  upgradeUrl: string;
  description: string;
  usage: {
    type: string;
    used: number;
    limit: number;
    remaining: number;
  };
  denialReason: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface FeatureAccessEnvelope {
  success: boolean;
  access: FeatureAccess;
}

const personaOptions: Array<{ value: RepositoryPersona; label: string }> = [
  { value: 'developer', label: 'Developer' },
  { value: 'product', label: 'Product Manager' },
  { value: 'business', label: 'Business Analyst' },
  { value: 'qa', label: 'QA Lead' }
];

const repositoryScanFeature = 'github_repository_scan';

export default function VibePilot() {
  const [generatedTest, setGeneratedTest] = useState<GeneratedTest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [repositoryBranch, setRepositoryBranch] = useState('main');
  const [repositoryFocus, setRepositoryFocus] = useState('');
  const [repositoryPersona, setRepositoryPersona] = useState<RepositoryPersona>('product');
  const [isScanningRepository, setIsScanningRepository] = useState(false);
  const [repositoryScan, setRepositoryScan] = useState<RepositoryScanResult | null>(null);
  const [repositoryError, setRepositoryError] = useState<string | null>(null);
  const [featureAccess, setFeatureAccess] = useState<FeatureAccess | null>(null);
  const [isCheckingFeature, setIsCheckingFeature] = useState(true);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFeatureAccess() {
      try {
        setIsCheckingFeature(true);
        const response = await api.getFeatureAccess(repositoryScanFeature) as FeatureAccessEnvelope;
        if (!cancelled) {
          setFeatureAccess(response.access);
        }
      } catch {
        if (!cancelled) {
          setFeatureAccess({
            feature: repositoryScanFeature,
            name: 'GitHub Repository Scenario Builder',
            planId: 'free',
            minimumPlan: 'pro',
            hasAccess: false,
            upgradeUrl: '/billing',
            description: 'Connect a GitHub repository reference and generate AI scenarios.',
            usage: {
              type: 'repositoryScans',
              used: 0,
              limit: 0,
              remaining: 0
            },
            denialReason: 'plan_required'
          });
        }
      } finally {
        if (!cancelled) {
          setIsCheckingFeature(false);
        }
      }
    }

    void loadFeatureAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async (data: {
    source: string;
    testType: 'E2E' | 'API' | 'Visual';
    framework: string;
  }) => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock API response - replace with actual API call
      const mockCode = `import { test, expect } from '@playwright/test';

test.describe('Generated Test', () => {
  test('should perform expected actions', async ({ page }) => {
    // Test generated from ${data.source}
    await page.goto('${data.source}');

    // Add assertions and steps here
    await expect(page).toHaveTitle(/.*/);
  });
});`;

      setGeneratedTest({
        id: Math.random().toString(36).substr(2, 9),
        code: mockCode,
        testType: data.testType,
        framework: data.framework,
        confidence: Math.floor(Math.random() * 20) + 80,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepositoryScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRepositoryError(null);
    setCopiedPrompt(false);

    if (featureAccess && !featureAccess.hasAccess) {
      setRepositoryError('GitHub repository scenario building is available on Professional, Team, and Enterprise plans.');
      return;
    }

    if (!repositoryUrl.trim()) {
      setRepositoryError('Enter a GitHub repository URL.');
      return;
    }

    setIsScanningRepository(true);

    try {
      const response = await api.scanRepositoryForScenarios({
        repositoryUrl,
        branch: repositoryBranch,
        focus: repositoryFocus,
        persona: repositoryPersona
      }) as ApiEnvelope<RepositoryScanResult>;

      setRepositoryScan(response.data);
      setFeatureAccess((current) => current
        ? {
            ...current,
            hasAccess: response.data.billing.usage.limit === -1 || response.data.billing.usage.remaining > 0,
            usage: response.data.billing.usage,
            planId: response.data.billing.planId,
            minimumPlan: response.data.billing.minimumPlan
          }
        : current);
      setGeneratedTest(null);
    } catch (err) {
      setRepositoryError(err instanceof Error ? err.message : 'Failed to scan repository');
    } finally {
      setIsScanningRepository(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!repositoryScan?.prompt) {
      return;
    }

    await navigator.clipboard.writeText(repositoryScan.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Vibe Test Pilot</h1>
          </div>
          <p className="text-slate-300">Generate tests using AI from URLs, descriptions, API endpoints, or GitHub repositories.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 space-y-6">
            <Card className="p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Github className="h-5 w-5 text-blue-300" /> GitHub Scenario Builder
              </h2>

              <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                    {featureAccess?.hasAccess ? (
                      <CheckCircle2 className="h-4 w-4 text-green-300" />
                    ) : (
                      <Lock className="h-4 w-4 text-amber-300" />
                    )}
                    Pro paid feature
                  </div>
                  <span className="rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-200">
                    {isCheckingFeature ? 'Checking' : `${featureAccess?.planId || 'free'} plan`}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Included in Professional, Team, and Enterprise. Demo workspace has Team access.
                </p>
                {featureAccess?.usage && (
                  <p className="mt-1 text-xs text-slate-400">
                    Usage: {featureAccess.usage.used}
                    {featureAccess.usage.limit === -1 ? ' / unlimited' : ` / ${featureAccess.usage.limit}`}
                  </p>
                )}
              </div>

              <form onSubmit={handleRepositoryScan} className="space-y-4">
                <div>
                  <label htmlFor="repository-url" className="text-sm font-medium text-slate-200 mb-2 block">
                    Repository URL
                  </label>
                  <input
                    id="repository-url"
                    type="url"
                    value={repositoryUrl}
                    onChange={(event) => setRepositoryUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                    disabled={isScanningRepository}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="repository-branch" className="text-sm font-medium text-slate-200 mb-2 block">
                    Branch
                  </label>
                  <div className="relative">
                    <GitBranch className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      id="repository-branch"
                      type="text"
                      value={repositoryBranch}
                      onChange={(event) => setRepositoryBranch(event.target.value)}
                      placeholder="main"
                      disabled={isScanningRepository}
                      className="w-full pl-9 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-200 mb-2 block">
                    Audience
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {personaOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRepositoryPersona(option.value)}
                        disabled={isScanningRepository}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          repositoryPersona === option.value
                            ? 'border-blue-400 bg-blue-500/20 text-white'
                            : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white'
                        } disabled:opacity-50`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="repository-focus" className="text-sm font-medium text-slate-200 mb-2 block">
                    Scan Focus
                  </label>
                  <textarea
                    id="repository-focus"
                    value={repositoryFocus}
                    onChange={(event) => setRepositoryFocus(event.target.value)}
                    placeholder="Checkout, auth, analytics, billing, compliance, release risk..."
                    disabled={isScanningRepository}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 h-24 resize-none"
                  />
                </div>

                {repositoryError && (
                  <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg flex gap-2 items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-200">{repositoryError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isScanningRepository}
                  aria-disabled={featureAccess ? !featureAccess.hasAccess : true}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                >
                  {isScanningRepository ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building scenarios...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Scan Prompt
                    </>
                  )}
                </button>
                {featureAccess && !featureAccess.hasAccess && (
                  <a
                    href={featureAccess.upgradeUrl}
                    className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
                  >
                    <Lock className="h-4 w-4" />
                    Upgrade to Professional
                  </a>
                )}
              </form>
            </Card>

            <Card className="p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> Generation Source
              </h2>
              <TestGenerationForm
                onGenerate={handleGenerate}
                isLoading={isLoading}
                error={error}
              />
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            {repositoryScan ? (
              <div className="space-y-6">
                <Card className="p-6 border border-blue-500/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
                    <div>
                      <div className="flex items-center gap-2 text-blue-300 text-sm font-medium mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {repositoryScan.connection.provider} {repositoryScan.connection.status.replace('_', ' ')}
                      </div>
                      <h2 className="text-2xl font-semibold text-white">
                        {repositoryScan.repository.fullName}
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">
                        Branch {repositoryScan.repository.branch} - {repositoryScan.message}
                      </p>
                      <p className="text-slate-500 text-xs mt-2">
                        Paid usage: {repositoryScan.billing.usage.used}
                        {repositoryScan.billing.usage.limit === -1 ? ' / unlimited' : ` / ${repositoryScan.billing.usage.limit}`} repository scans on {repositoryScan.billing.planId}.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${repositoryScan.connection.liveIndexing ? 'bg-green-500/15 text-green-200' : 'bg-amber-500/15 text-amber-200'}`}>
                          {repositoryScan.connection.liveIndexing
                            ? `${repositoryScan.connection.indexedFiles?.length || 0} files indexed`
                            : 'URL-only context'}
                        </span>
                        {repositoryScan.connection.error && (
                          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                            {repositoryScan.connection.error}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 border border-slate-600 hover:bg-slate-700"
                    >
                      <Clipboard className="h-4 w-4" />
                      {copiedPrompt ? 'Copied' : 'Copy Prompt'}
                    </button>
                  </div>

                  <div className="bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
                    <pre className="max-h-80 overflow-auto p-4 text-sm leading-6 text-slate-200 whitespace-pre-wrap">
                      {repositoryScan.prompt}
                    </pre>
                  </div>

                  {repositoryScan.connection.indexedFiles && repositoryScan.connection.indexedFiles.length > 0 && (
                    <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4">
                      <h3 className="text-sm font-semibold text-slate-200 mb-3">Indexed Repository Context</h3>
                      <div className="flex flex-wrap gap-2">
                        {repositoryScan.connection.indexedFiles.map((file) => (
                          <span key={file.path} className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                            {file.path}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    AI Scenario Starters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {repositoryScan.scenarios.map((scenario) => (
                      <article
                        key={scenario.id}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-200">
                            {scenario.type}
                          </span>
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200">
                            {scenario.priority}
                          </span>
                          <span className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200">
                            {scenario.persona}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-white mb-2">
                          {scenario.name}
                        </h4>
                        <p className="text-sm text-slate-300 mb-3">
                          {scenario.rationale}
                        </p>
                        <div className="text-xs text-slate-400 mb-3">
                          {scenario.sourcePaths.join(', ')}
                        </div>
                        <ol className="space-y-2 text-sm text-slate-200">
                          {scenario.steps.map((step) => (
                            <li key={step} className="flex gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </article>
                    ))}
                  </div>
                </Card>
              </div>
            ) : generatedTest ? (
              <Card className="p-6 border border-slate-700">
                <GeneratedCodeView
                  code={generatedTest.code}
                  testType={generatedTest.testType}
                  framework={generatedTest.framework}
                  confidence={generatedTest.confidence}
                />
              </Card>
            ) : (
              <Card className="p-12 border border-slate-700 flex items-center justify-center min-h-96">
                <div className="text-center">
                  <Brain className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">Generate scenarios or test code to see results here</p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
