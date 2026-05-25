import { useState } from 'react';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../atoms';

interface TestGenerationFormProps {
  onGenerate: (data: {
    source: string;
    testType: 'E2E' | 'API' | 'Visual';
    framework: string;
  }) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

const frameworks = {
  'E2E': ['Playwright', 'Cypress', 'Selenium', 'Puppeteer'],
  'API': ['Playwright', 'Axios', 'Jest', 'Supertest'],
  'Visual': ['Playwright', 'BackstopJS', 'Percy'],
};

export function TestGenerationForm({
  onGenerate,
  isLoading = false,
  error = null,
}: TestGenerationFormProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'description' | 'api'>('url');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [testType, setTestType] = useState<'E2E' | 'API' | 'Visual'>('E2E');
  const [framework, setFramework] = useState('Playwright');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let source = '';
    if (activeTab === 'url') source = url;
    else if (activeTab === 'description') source = description;
    else source = apiEndpoint;

    if (!source.trim()) {
      alert('Please fill in the required field');
      return;
    }

    await onGenerate({ source, testType, framework });
  };

  const handleTestTypeChange = (newType: 'E2E' | 'API' | 'Visual') => {
    setTestType(newType);
    setFramework(frameworks[newType][0]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tab Selection */}
      <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
        {(['url', 'description', 'api'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {tab === 'url' ? 'URL' : tab === 'description' ? 'Text' : 'API'}
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div>
        <label className="text-sm font-medium text-slate-200 mb-2 block">
          {activeTab === 'url'
            ? 'Website URL'
            : activeTab === 'description'
            ? 'Test Description'
            : 'API Endpoint'}
        </label>
        {activeTab === 'description' ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what test you want to generate..."
            disabled={isLoading}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 h-24 resize-none"
          />
        ) : (
          <input
            type={activeTab === 'api' ? 'text' : 'url'}
            value={activeTab === 'url' ? url : apiEndpoint}
            onChange={(e) =>
              activeTab === 'url' ? setUrl(e.target.value) : setApiEndpoint(e.target.value)
            }
            placeholder={
              activeTab === 'url' ? 'https://example.com' : 'https://api.example.com/endpoint'
            }
            disabled={isLoading}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        )}
      </div>

      {/* Test Type Selection */}
      <div>
        <label className="text-sm font-medium text-slate-200 mb-2 block">Test Type</label>
        <select
          value={testType}
          onChange={(e) => handleTestTypeChange(e.target.value as 'E2E' | 'API' | 'Visual')}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          <option value="E2E">End-to-End (E2E)</option>
          <option value="API">API Testing</option>
          <option value="Visual">Visual Regression</option>
        </select>
      </div>

      {/* Framework Selection */}
      <div>
        <label className="text-sm font-medium text-slate-200 mb-2 block">Framework</label>
        <select
          value={framework}
          onChange={(e) => setFramework(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
        >
          {frameworks[testType].map((fw) => (
            <option key={fw} value={fw}>{fw}</option>
          ))}
        </select>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg flex gap-2 items-start">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-200">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Test
          </>
        )}
      </Button>
    </form>
  );
}
