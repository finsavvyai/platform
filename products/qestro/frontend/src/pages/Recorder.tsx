import { useState } from 'react';
import { Play, Square, Globe, Code, FileText } from 'lucide-react';
import { Card, Button } from '../components/atoms';
import { motion } from 'framer-motion';
import { ActionTimeline } from '../components/recorder/ActionTimeline';

interface RecordedAction {
  id: string;
  type: 'click' | 'type' | 'navigate' | 'wait' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  duration?: number;
}

const MOCK_GENERATED_CODE = `import { test, expect } from '@playwright/test';

test.describe('Recorded Session', () => {
  test('user flow', async ({ page }) => {
    await page.goto('https://app.example.com');
    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="login-btn"]');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.screenshot({ path: 'screenshot.png' });
    await expect(page).toHaveURL(/\\/dashboard/);
  });
});`;

export default function Recorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('https://');
  const [actions, setActions] = useState<RecordedAction[]>([
    { id: '1', type: 'navigate', url: 'https://app.example.com', timestamp: 0 },
    { id: '2', type: 'wait', duration: 2, timestamp: 1000 },
    { id: '3', type: 'click', selector: '[data-testid="login-btn"]', timestamp: 3000 },
    { id: '4', type: 'type', selector: 'input[name="email"]', value: 'test@example.com', timestamp: 3500 },
    { id: '5', type: 'screenshot', timestamp: 4000 },
  ]);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartRecording = () => {
    if (!recordingUrl || recordingUrl === 'https://') {
      alert('Please enter a valid URL');
      return;
    }
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setShowCode(true);
  };

  const handleDeleteAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(MOCK_GENERATED_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const el = document.createElement('a');
    el.href = `data:text/plain;charset=utf-8,${encodeURIComponent(MOCK_GENERATED_CODE)}`;
    el.download = 'recorded-test.spec.ts';
    el.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Test Recorder</h1>
          </div>
          <p className="text-slate-300">Record browser actions and generate Playwright code automatically</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1">
            <Card className="p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Play className="h-5 w-5" /> Recording Setup
              </h2>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-sm font-medium text-slate-300">
                    {isRecording ? 'Recording in progress' : 'Not recording'}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium text-slate-200 mb-2 block">Target URL</label>
                <input
                  type="url"
                  value={recordingUrl}
                  onChange={(e) => setRecordingUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isRecording}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="flex gap-3 mb-6">
                {!isRecording ? (
                  <Button
                    onClick={handleStartRecording}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                )}
              </div>

              {!isRecording && (
                <div className="space-y-3 pt-6 border-t border-slate-600">
                  <h3 className="text-sm font-medium text-slate-300">Settings</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-300">Record screenshots</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                    <span className="text-sm text-slate-300">Auto-wait for elements</span>
                  </label>
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
            <Card className="p-6 border border-slate-700 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5" /> Recording Timeline
              </h2>
              <ActionTimeline
                actions={actions}
                isRecording={isRecording}
                onDeleteAction={handleDeleteAction}
              />
            </Card>

            {showCode && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-6 border border-slate-700">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Code className="h-5 w-5 text-green-400" />
                    Generated Test Code
                  </h2>

                  <pre className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto text-sm text-slate-200 mb-4 max-h-64">
                    <code>{MOCK_GENERATED_CODE}</code>
                  </pre>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleCopyCode}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      }`}
                    >
                      {copied ? 'Copied!' : 'Copy Code'}
                    </Button>
                    <Button
                      onClick={handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >
                      Download
                    </Button>
                    <Button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700">
                      <Play className="h-4 w-4" />
                      Save & Run
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
