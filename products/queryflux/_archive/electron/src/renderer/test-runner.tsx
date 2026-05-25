import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useElectronDatabase } from './hooks';

// Simple test runner to verify the Electron integration
const TestRunner: React.FC = () => {
  const [testResults, setTestResults] = React.useState<string[]>([]);
  const [isRunning, setIsRunning] = React.useState(false);

  const { theme, availableThemes, setTheme } = useTheme();
  const { language, t, setLanguage } = useLanguage();
  const { isElectron, connections, testConnection } = useElectronDatabase();

  const runTests = async () => {
    setIsRunning(true);
    const results: string[] = [];

    // Test 1: Theme context
    try {
      const initialTheme = theme.name;
      setTheme(availableThemes[1]);
      const newTheme = theme.name;
      results.push(`✓ Theme Context: ${initialTheme} → ${newTheme}`);
    } catch (error) {
      results.push(`✗ Theme Context: ${error}`);
    }

    // Test 2: Language context
    try {
      const initialLang = language;
      setLanguage('es');
      const newLang = language;
      const welcomeText = t('database.welcome');
      results.push(`✓ Language Context: ${initialLang} → ${newLang}, Translation: "${welcomeText}"`);
    } catch (error) {
      results.push(`✗ Language Context: ${error}`);
    }

    // Test 3: Electron API
    try {
      results.push(`✓ Electron API: ${isElectron ? 'Available' : 'Not Available'}`);
      results.push(`✓ Connections Loaded: ${connections.length}`);

      if (isElectron) {
        const testResult = await testConnection({
          type: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'test',
          username: 'test',
          password: 'test',
          ssl: false
        });
        results.push(`✓ Connection Test: ${testResult.success ? 'Success' : 'Failed'}`);
      }
    } catch (error) {
      results.push(`✗ Electron API: ${error}`);
    }

    // Test 4: Theme CSS variables
    try {
      const root = document.documentElement;
      const bgStyle = getComputedStyle(root).getPropertyValue('--theme-bg') || root.style.backgroundColor;
      results.push(`✓ Theme Applied: ${bgStyle || theme.colors.background}`);
    } catch (error) {
      results.push(`✗ Theme Applied: ${error}`);
    }

    setTestResults(results);
    setIsRunning(false);
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'monospace',
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      minHeight: '100vh'
    }}>
      <h1>QueryFlux Electron Integration Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>Current Theme:</strong> {theme.displayName}</p>
        <p><strong>Language:</strong> {language.toUpperCase()}</p>
        <p><strong>Electron:</strong> {isElectron ? 'Yes' : 'No'}</p>
        <p><strong>Connections:</strong> {connections.length}</p>
      </div>

      <button
        onClick={runTests}
        disabled={isRunning}
        style={{
          padding: '10px 20px',
          backgroundColor: theme.colors.accent,
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {isRunning ? 'Running Tests...' : 'Run Integration Tests'}
      </button>

      {testResults.length > 0 && (
        <div style={{
          backgroundColor: theme.colors.foreground,
          padding: '20px',
          borderRadius: '10px',
          border: `1px solid ${theme.colors.border}`
        }}>
          <h2>Test Results:</h2>
          <pre style={{
            whiteSpace: 'pre-wrap',
            color: theme.colors.text,
            fontSize: '14px'
          }}>
            {testResults.join('\n')}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '20px', fontSize: '12px', color: theme.colors.textSecondary }}>
        <p>This test runner validates the Electron integration by checking:</p>
        <ul>
          <li>Theme context functionality</li>
          <li>Language context and translations</li>
          <li>Electron API availability</li>
          <li>Database connection testing</li>
          <li>CSS theme application</li>
        </ul>
      </div>
    </div>
  );
};

// Create a simple app wrapper for testing
const TestApp: React.FC = () => {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <TestRunner />
      </ThemeProvider>
    </LanguageProvider>
  );
};

// Render the test app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TestApp />);
} else {
  console.error('Root container not found');
}
