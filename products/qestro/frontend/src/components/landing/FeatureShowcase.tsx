import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code, Zap, Globe, Cpu } from 'lucide-react';
import { Tabs } from '../atoms/Tabs/Tabs';
import { Card } from '../atoms/Card/Card';

const FeatureShowcase = () => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      name: 'URL to Test',
      icon: <Globe className="w-5 h-5" />,
      description: 'Paste any URL, describe your test in plain English. AI generates Playwright code.',
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">You: "Test the checkout flow on my SaaS"</p>
          <pre className="bg-slate-950 p-4 rounded-lg text-xs text-slate-200 overflow-auto max-h-64">
{`const { test } = require('@playwright/test');

test('checkout flow', async ({ page }) => {
  await page.goto('https://app.example.com');
  await page.click('text=Pricing');
  await page.click('button:has-text("Subscribe")');

  // Fill payment form
  await page.fill('[name="card-number"]', '4242...');
  await page.click('text=Confirm Payment');

  // Assert success
  await expect(page.locator('text=Success')).toBeVisible();
});`}
          </pre>
          <p className="text-blue-400 text-sm font-semibold">Generated instantly. Edit as needed.</p>
        </div>
      )
    },
    {
      name: 'Self-Healing',
      icon: <Zap className="w-5 h-5" />,
      description: 'Selectors change? We detect and auto-fix assertions. No more "element not found" errors.',
      content: (
        <div className="space-y-4">
          <div className="bg-red-950 border border-red-700 p-4 rounded-lg">
            <p className="text-red-300 font-semibold mb-2">Before: Assertion Failed</p>
            <p className="text-red-400 text-sm">Locator '#login-btn' not found (selector changed)</p>
          </div>
          <div className="bg-green-950 border border-green-700 p-4 rounded-lg">
            <p className="text-green-300 font-semibold mb-2">After: Auto-Healed</p>
            <p className="text-green-400 text-sm">Updated selector to '[data-testid="login"]' - Test passes</p>
          </div>
          <p className="text-slate-400 text-sm">Reduce maintenance by 80%. Your tests adapt automatically.</p>
        </div>
      )
    },
    {
      name: 'Cross-Browser Matrix',
      icon: <Globe className="w-5 h-5" />,
      description: 'Run your test on Chrome, Firefox, Safari, and Edge simultaneously.',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'Chrome', status: 'pass', time: '12.3s' },
              { name: 'Firefox', status: 'pass', time: '14.1s' },
              { name: 'Safari', status: 'pass', time: '16.8s' },
              { name: 'Edge', status: 'pass', time: '13.5s' }
            ].map((browser) => (
              <Card key={browser.name} className="p-4 border-slate-700">
                <p className="font-semibold text-sm">{browser.name}</p>
                <p className="text-green-400 text-xs mt-1">✓ Passed</p>
                <p className="text-slate-500 text-xs mt-2">{browser.time}</p>
              </Card>
            ))}
          </div>
          <p className="text-slate-400 text-sm">Parallel execution. No flaky tests across browsers.</p>
        </div>
      )
    },
    {
      name: 'MCP Integration',
      icon: <Cpu className="w-5 h-5" />,
      description: 'Claude native. Ask Claude to generate, fix, or optimize your tests.',
      content: (
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-lg border border-blue-700">
            <p className="text-blue-300 font-semibold mb-2">Claude asks:</p>
            <p className="text-slate-300 text-sm">"What does this test do? Why did it fail?"</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <p className="text-slate-300 font-semibold mb-2">You describe:</p>
            <p className="text-slate-400 text-sm">"It tests user signup with email validation"</p>
          </div>
          <div className="bg-green-950 p-4 rounded-lg border border-green-700">
            <p className="text-green-300 font-semibold mb-2">Claude generates fixes:</p>
            <p className="text-green-400 text-sm">Updated assertions + added retry logic</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="px-6 py-20 md:px-12 bg-slate-900/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Powerful Features in Action</h2>
          <p className="text-slate-400 text-lg">Click through to see how Qestro simplifies testing</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Tabs
              tabs={tabs.map((tab, idx) => ({
                label: tab.name,
                id: String(idx)
              }))}
              activeTab={String(activeTab)}
              onChange={(id: string) => setActiveTab(parseInt(id))}
              className="flex flex-col gap-4"
            />
            <div className="space-y-4 mt-4">
              {tabs.map((tab, idx) => (
                activeTab === idx && (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="p-6 border-blue-700/50 bg-slate-800/50">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-blue-400">{tab.icon}</div>
                        <h3 className="text-xl font-semibold">{tab.name}</h3>
                      </div>
                      <p className="text-slate-400 text-sm mb-6">{tab.description}</p>
                      {tab.content}
                    </Card>
                  </motion.div>
                )
              ))}
            </div>
          </motion.div>

          {/* Preview Image / Code Block */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center"
          >
            <Card className="w-full p-8 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <Code className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-semibold">Live Preview</h3>
                </div>

                <div className="bg-slate-950 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-2">
                  <div>
                    <span className="text-slate-500">$</span> <span className="text-blue-400">npx qestro run</span>
                  </div>
                  <div className="text-slate-500">Loading test...</div>
                  <div className="animate-pulse">
                    <span className="text-yellow-400">▶</span> Browser: Chromium
                  </div>
                  <div className="animate-pulse delay-100">
                    <span className="text-yellow-400">▶</span> Recording actions...
                  </div>
                  <div className="text-green-400">✓ Test passed in 14.2s</div>
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-slate-400 text-xs">
                    Test executes instantly. Self-healing catches issues before they become problems.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FeatureShowcase;
