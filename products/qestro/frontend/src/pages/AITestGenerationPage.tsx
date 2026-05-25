import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, FileText, Globe, Smartphone, Database, Zap, Download, Copy, Play, Lightbulb, Shield } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

interface GeneratedTest {
  id: string;
  title: string;
  description: string;
  testType: 'web' | 'mobile' | 'api' | 'performance';
  code: string;
  framework: string;
  confidence: number;
  estimatedDuration: number;
  createdAt: Date;
}

interface TestGenerationRequest {
  prompt: string;
  testType: 'web' | 'mobile' | 'api' | 'performance';
  framework?: string;
  includeSetup: boolean;
  includeCleanup: boolean;
  complexity: 'basic' | 'intermediate' | 'advanced';
  additionalContext?: string;
}

const createMockGeneratedTests = (): GeneratedTest[] => [
  {
    id: '1',
    title: 'Login Form Validation Test',
    description: 'Comprehensive test for user login form including field validation, error handling, and successful authentication',
    testType: 'web',
    code: `import { test, expect } from '@playwright/test';

test.describe('Login Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should validate empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');
    
    await expect(page.locator('[data-testid="email-error"]'))
      .toHaveText('Email is required');
    await expect(page.locator('[data-testid="password-error"]'))
      .toHaveText('Password is required');
  });

  test('should validate email format', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('[data-testid="email-error"]'))
      .toHaveText('Please enter a valid email address');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'validPassword123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'wrongPassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('[data-testid="login-error"]'))
      .toHaveText('Invalid email or password');
  });
});`,
    framework: 'Playwright',
    confidence: 95,
    estimatedDuration: 5,
    createdAt: new Date(Date.now() - 30 * 60 * 1000)
  }
];

export default function AITestGenerationPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<GeneratedTest[]>(createMockGeneratedTests);
  const [selectedTest, setSelectedTest] = useState<GeneratedTest | null>(null);
  const [request, setRequest] = useState<TestGenerationRequest>({
    prompt: '',
    testType: 'web',
    includeSetup: true,
    includeCleanup: true,
    complexity: 'intermediate',
  });

  const [examples] = useState([
    {
      title: 'E-commerce Checkout Flow',
      prompt: 'Test the complete checkout process for an e-commerce website including adding items to cart, entering shipping information, selecting payment method, and completing the purchase',
      type: 'web' as const,
      icon: '🛒'
    },
    {
      title: 'Mobile Login Authentication',
      prompt: 'Test user authentication flow on mobile app including email validation, password requirements, biometric login, and error handling for invalid credentials',
      type: 'mobile' as const,
      icon: '📱'
    },
    {
      title: 'REST API User Management',
      prompt: 'Test CRUD operations for user management API including creating users, updating profiles, deleting accounts, and handling authorization',
      type: 'api' as const,
      icon: '🔗'
    },
    {
      title: 'Performance Load Testing',
      prompt: 'Test system performance under high load with 1000 concurrent users accessing the dashboard, checking response times and resource usage',
      type: 'performance' as const,
      icon: '⚡'
    }
  ]);

  const frameworks = {
    web: ['Playwright', 'Cypress', 'Selenium', 'Puppeteer', 'TestCafe'],
    mobile: ['Appium', 'Maestro', 'Detox', 'XCUITest', 'Espresso'],
    api: ['Postman', 'REST Assured', 'Supertest', 'Insomnia', 'Newman'],
    performance: ['JMeter', 'K6', 'Artillery', 'Gatling', 'LoadRunner']
  };

  const handleGenerate = async () => {
    if (!request.prompt.trim()) return;

    setIsGenerating(true);
    
    // Simulate AI generation
    setTimeout(() => {
      const newTest: GeneratedTest = {
        id: Date.now().toString(),
        title: `Generated Test: ${request.prompt.substring(0, 50)}...`,
        description: `AI-generated test for ${request.testType} testing based on your requirements`,
        testType: request.testType,
        code: `// AI-Generated Test Code for: ${request.prompt}
// Framework: ${request.framework || frameworks[request.testType][0]}
// Complexity: ${request.complexity}

// This is a demo of AI-generated test code
// In production, this would be generated by GPT-4 or similar AI model

test.describe('${request.prompt}', () => {
  test.beforeEach(async () => {
    // Setup code would be generated here
  });

  test('main test case', async () => {
    // Test implementation based on prompt
    // Would include specific steps, assertions, and error handling
  });

  test.afterEach(async () => {
    // Cleanup code would be generated here
  });
});`,
        framework: request.framework || frameworks[request.testType][0],
        confidence: Math.floor(Math.random() * 20) + 80,
        estimatedDuration: Math.floor(Math.random() * 10) + 3,
        createdAt: new Date()
      };

      setGeneratedTests(prev => [newTest, ...prev]);
      setSelectedTest(newTest);
      setIsGenerating(false);
    }, 3000);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const downloadTest = (test: GeneratedTest) => {
    const element = document.createElement('a');
    const file = new Blob([test.code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${test.title.replace(/[^a-z0-9]/gi, '_')}.spec.js`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleRunTest = async (test: GeneratedTest) => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      await api.createAutomationRun({
        name: test.title,
        projectId: 'ai-generated',
        userId: user?.id ?? 'current-user',
        testCases: [{ id: test.id, name: test.title, code: test.code }],
        config: {
          parallel: false,
          environment: 'staging',
          captureScreenshots: true,
        },
        metadata: {
          source: 'ai-test-generation',
          framework: test.framework,
          testType: test.testType,
        },
      });
      navigate('/runs');
    } catch (error) {
      console.error('Run AI-generated test failed:', error);
      alert('Could not start the test run. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'web': return <Globe className="h-4 w-4" />;
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'api': return <Database className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const remainingGenerations = user?.subscription?.aiCallsRemaining || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain className="h-8 w-8 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Test Generation</h1>
              <p className="mt-1 text-sm text-gray-500">
                Generate comprehensive test suites using artificial intelligence
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>{remainingGenerations} generations remaining this month</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Enterprise-grade AI models</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Generate New Test</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What do you want to test?
                  </label>
                  <textarea
                    value={request.prompt}
                    onChange={(e) => setRequest({ ...request, prompt: e.target.value })}
                    placeholder="Describe what you want to test in natural language..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Test Type
                    </label>
                    <select
                      value={request.testType}
                      onChange={(e) => setRequest({ ...request, testType: e.target.value as TestGenerationRequest['testType'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="web">Web Testing</option>
                      <option value="mobile">Mobile Testing</option>
                      <option value="api">API Testing</option>
                      <option value="performance">Performance Testing</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Framework
                    </label>
                    <select
                      value={request.framework || ''}
                      onChange={(e) => setRequest({ ...request, framework: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Auto-select</option>
                      {frameworks[request.testType].map(framework => (
                        <option key={framework} value={framework}>{framework}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complexity Level
                  </label>
                  <div className="flex gap-3">
                    {['basic', 'intermediate', 'advanced'].map(level => (
                      <label key={level} className="flex items-center">
                        <input
                          type="radio"
                          value={level}
                          checked={request.complexity === level}
                          onChange={(e) => setRequest({ ...request, complexity: e.target.value as TestGenerationRequest['complexity'] })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-2 text-sm text-gray-700 capitalize">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={request.includeSetup}
                      onChange={(e) => setRequest({ ...request, includeSetup: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include setup</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={request.includeCleanup}
                      onChange={(e) => setRequest({ ...request, includeCleanup: e.target.checked })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include cleanup</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Context (Optional)
                  </label>
                  <textarea
                    value={request.additionalContext || ''}
                    onChange={(e) => setRequest({ ...request, additionalContext: e.target.value })}
                    placeholder="Any additional context, requirements, or constraints..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={2}
                  />
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!request.prompt.trim() || isGenerating || remainingGenerations <= 0}
                  className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating Test...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Test
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Example Prompts</h3>
              <div className="space-y-3">
                {examples.map((example, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                    onClick={() => setRequest({ ...request, prompt: example.prompt, testType: example.type })}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{example.icon}</span>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{example.title}</h4>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{example.prompt}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Generated Tests</h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {generatedTests.length === 0 ? (
                  <div className="p-6 text-center">
                    <Lightbulb className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tests generated yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Use the form to generate your first AI-powered test
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {generatedTests.map((test) => (
                      <div
                        key={test.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${
                          selectedTest?.id === test.id ? 'bg-indigo-50 border-r-2 border-indigo-500' : ''
                        }`}
                        onClick={() => setSelectedTest(test)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(test.testType)}
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {test.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              test.confidence >= 90 ? 'bg-green-100 text-green-800' :
                              test.confidence >= 75 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {test.confidence}% confident
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{test.framework}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {test.createdAt.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedTest && (
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Test Code</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(selectedTest.code)}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                      <button
                        onClick={() => downloadTest(selectedTest)}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                      <button
                        onClick={() => handleRunTest(selectedTest)}
                        disabled={isRunning}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Play className="h-4 w-4" />
                        {isRunning ? 'Starting…' : 'Run Test'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">{selectedTest.description}</p>
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      <span>Framework: {selectedTest.framework}</span>
                      <span>Duration: ~{selectedTest.estimatedDuration}min</span>
                      <span>Confidence: {selectedTest.confidence}%</span>
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm text-gray-100 whitespace-pre-wrap">
                      <code>{selectedTest.code}</code>
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
