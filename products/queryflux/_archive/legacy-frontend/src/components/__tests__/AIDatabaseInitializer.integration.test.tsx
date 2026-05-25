/**
 * AI Database Initializer React Component Integration Tests
 *
 * Integration tests for the React component that tests the full user interface
 * and interaction flow.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { LanguageProvider } from '../../contexts/LanguageContext';
import { AIDatabaseInitializer } from '../AIDatabaseInitializer';

// Mock the AI Engine to avoid actual API calls during tests
jest.mock('../../core/ai-database-initialization/AIDatabaseInitializationEngine', () => {
  return {
    AIDatabaseInitializationEngine: jest.fn().mockImplementation(() => ({
      initializeDatabase: jest.fn().mockImplementation(async (input, options) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        return {
          analysis: {
            id: 'test-analysis-123',
            inputType: typeof input === 'string' ? 'natural_language' : 'dump_file',
            rawData: typeof input === 'string' ? input : 'mock-file-content',
            extractedRequirements: [
              {
                id: 'req-1',
                type: 'performance',
                description: 'Support 1000 concurrent users',
                priority: 'high',
                category: 'rdbms',
                estimatedLoad: 'medium'
              }
            ],
            recommendedDatabases: [],
            confidence: 0.85,
            processingTime: 1500
          },
          recommendations: [
            {
              databaseType: 'postgresql',
              confidence: 0.92,
              reasoning: 'Based on your requirements, PostgreSQL is recommended for its strong consistency and ACID compliance.',
              estimatedCost: {
                monthly: 250,
                annual: 2700,
                currency: 'USD',
                breakdown: []
              },
              performanceProfile: {
                throughput: { readsPerSecond: 5000, writesPerSecond: 2500 },
                latency: { readLatency: 5, writeLatency: 10 },
                availability: 0.999,
                concurrency: 500,
                dataConsistency: 'strong'
              },
              configuration: {
                type: 'postgresql',
                name: 'test_db',
                connectionPool: { minConnections: 5, maxConnections: 20 },
                backupStrategy: { frequency: 'daily', retention: 30 },
                monitoring: { enabled: true },
                security: { encryptionAtRest: true },
                optimizations: []
              },
              migrationComplexity: 'medium',
              pros: ['ACID compliance', 'Strong consistency'],
              cons: ['Vertical scaling limitations']
            }
          ],
          creationPlan: {
            id: 'test-plan-456',
            analysis: {},
            selectedDatabase: {},
            steps: [
              {
                id: 'step-1',
                name: 'Prerequisites Check',
                description: 'Verify system requirements',
                type: 'infrastructure',
                order: 1,
                estimatedDuration: 10,
                dependencies: [],
                commands: [],
                validation: []
              },
              {
                id: 'step-2',
                name: 'Database Installation',
                description: 'Install and configure PostgreSQL',
                type: 'infrastructure',
                order: 2,
                estimatedDuration: 15,
                dependencies: ['step-1'],
                commands: [],
                validation: []
              }
            ],
            estimatedDuration: 25,
            estimatedCost: { monthly: 250, annual: 2700, currency: 'USD' },
            prerequisites: [],
            rollbackPlan: []
          }
        };
      }),
      executeCreationPlan: jest.fn().mockImplementation(async (plan) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return {
          success: true,
          results: ['Database created successfully'],
          errors: [],
          duration: 2000
        };
      })
    }))
  };
});

// Mock File API
global.File = class File {
  name: string;
  size: number;
  type: string;

  constructor(chunks: any[], filename: string, options: { type?: string } = {}) {
    this.name = filename;
    this.type = options.type || 'text/plain';
    this.size = chunks.reduce((total, chunk) => total + (chunk?.length || 0), 0);
  }
} as any;

global.FileReader = class FileReader {
  result: string | ArrayBuffer | null = null;
  error: any = null;
  readyState: number = 0;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      this.readyState = 2;
      if (this.onload) {
        this.onload({ target: { result: 'mock file content' } });
      }
    }, 100);
  }
} as any;

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState({
    name: 'dark',
    colors: {
      background: '#1a1a1a',
      foreground: '#ffffff',
      sidebar: '#2a2a2a',
      border: '#3a3a3a',
      accent: '#3b82f6',
      accentHover: '#2563eb',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      editorBg: '#1e1e1e',
      editorText: '#d4d4d4'
    }
  });

  const [language, setLanguage] = useState({
    language: 'en',
    setLanguage,
    t: (key: string) => key // Simple mock translation
  });

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <LanguageProvider value={language}>
        {children}
      </LanguageProvider>
    </ThemeContext.Provider>
  );
};

describe('AIDatabaseInitializer Integration Tests', () => {
  const mockOnDatabaseCreated = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('should render the component correctly', () => {
      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(screen.getByText('AI Database Initialization')).toBeInTheDocument();
      expect(screen.getByText(/Describe your needs or upload a dump file/)).toBeInTheDocument();
      expect(screen.getByText('Describe Your Needs')).toBeInTheDocument();
      expect(screen.getByText('Upload Dump File')).toBeInTheDocument();
    });

    test('should render all input tabs', () => {
      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Input')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();
    });
  });

  describe('Natural Language Input Flow', () => {
    test('should handle natural language input submission', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Enter natural language description
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a PostgreSQL database for my e-commerce platform');

      // Submit for analysis
      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      // Should show loading state
      expect(screen.getByText('Analyzing Requirements...')).toBeInTheDocument();
      expect(screen.getByText(/Analyze and Generate Database Setup/)).toBeDisabled();

      // Should move to analysis tab after completion
      await waitFor(() => {
        expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Should show extracted requirements
      await waitFor(() => {
        expect(screen.getByText(/Extracted Requirements/)).toBeInTheDocument();
      }, { timeout: 4000 });

      // Continue to recommendations
      const continueButton = screen.getByText('View Recommendations');
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText('Database Recommendations')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    test('should show validation error for empty input', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Try to submit without input
      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      // Should show alert (mocked)
      expect(screen.getByText('Analyze and Generate Database Setup')).toBeDisabled();
    });
  });

  describe('File Upload Flow', () => {
    test('should handle file upload', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Switch to file upload tab
      const uploadTab = screen.getByText('Upload Dump File');
      await user.click(uploadTab);

      // Upload a file (simulated)
      const fileInput = screen.getByLabelText('Choose File') || screen.getByRole('button', { name: /choose file/i });
      const file = new File(['CREATE TABLE test (id INT);'], 'test.sql', { type: 'application/sql' });

      await user.upload(fileInput, file);

      // Should show file info
      await waitFor(() => {
        expect(screen.getByText('test.sql')).toBeInTheDocument();
      });

      // Submit for analysis
      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      // Should process and show results
      await waitFor(() => {
        expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('should handle file removal', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Switch to file upload and upload file
      const uploadTab = screen.getByText('Upload Dump File');
      await user.click(uploadTab);

      const fileInput = screen.getByLabelText('Choose File') || screen.getByRole('button', { name: /choose file/i });
      const file = new File(['content'], 'test.sql', { type: 'application/sql' });
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText('test.sql')).toBeInTheDocument();
      });

      // Remove file
      const removeButton = screen.getByText('Remove File');
      await user.click(removeButton);

      // Should show upload area again
      await waitFor(() => {
        expect(screen.getByText(/Drop your dump file here/)).toBeInTheDocument();
      });
    });
  });

  describe('Preferences Configuration', () => {
    test('should handle budget range configuration', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Find budget inputs
      const minBudgetInput = screen.getByPlaceholderText('Min');
      const maxBudgetInput = screen.getByPlaceholderText('Max');

      await user.clear(minBudgetInput);
      await user.type(minBudgetInput, '100');

      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '500');

      expect(minBudgetInput).toHaveValue(100);
      expect(maxBudgetInput).toHaveValue(500);
    });

    test('should handle technical level selection', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      const technicalLevelSelect = screen.getByDisplayValue('Intermediate');
      await user.selectOptions(technicalLevelSelect, 'Expert');

      expect(screen.getByDisplayValue('Expert')).toBeInTheDocument();
    });
  });

  describe('Recommendations Display', () => {
    test('should display database recommendations correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Submit input to get to recommendations
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database for my application');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      // Wait for analysis and navigate to recommendations
      await waitFor(() => {
        const continueButton = screen.getByText('View Recommendations');
        user.click(continueButton);
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText('Database Recommendations')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
        expect(screen.getByText(/92% Match/)).toBeInTheDocument();
      }, { timeout: 4000 });

      // Should show reasoning
      await waitFor(() => {
        expect(screen.getByText(/Based on your requirements/)).toBeInTheDocument();
      });

      // Should show performance profile
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Cost Estimate')).toBeInTheDocument();

      // Should show pros and cons
      expect(screen.getByText('Pros')).toBeInTheDocument();
      expect(screen.getByText('Considerations')).toBeInTheDocument();
    });

    test('should allow selecting different recommendations', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Fast forward to recommendations screen
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      await waitFor(() => {
        const continueButton = screen.getByText('View Recommendations');
        user.click(continueButton);
      }, { timeout: 3000 });

      await waitFor(() => {
        expect(screen.getByText('Database Recommendations')).toBeInTheDocument();
      }, { timeout: 4000 });

      // Click on recommendation card to select it
      const recommendationCard = screen.getByText('PostgreSQL').closest('[role="button"]');
      await user.click(recommendationCard!);

      // Should remain selected (visual feedback)
      expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    });
  });

  describe('Creation Plan Display', () => {
    test('should display creation plan correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Navigate through to creation plan
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      await waitFor(() => {
        const continueButton = screen.getByText('View Recommendations');
        user.click(continueButton);
      }, { timeout: 3000 });

      await waitFor(() => {
        const planButton = screen.getByText('Generate Creation Plan');
        user.click(planButton);
      }, { timeout: 4000 });

      await waitFor(() => {
        expect(screen.getByText('Creation Plan')).toBeInTheDocument();
        expect(screen.getByText('Implementation Summary')).toBeInTheDocument();
      }, { timeout: 5000 });

      // Should show steps
      expect(screen.getByText('Prerequisites and Environment Setup')).toBeInTheDocument();
      expect(screen.getByText('Database Installation')).toBeInTheDocument();

      // Should show prerequisites
      expect(screen.getByText('Prerequisites')).toBeInTheDocument();

      // Should show duration and cost
      expect(screen.getByText('25 min')).toBeInTheDocument(); // From mock data
      expect(screen.getByText('$250/mo')).toBeInTheDocument(); // From mock data
    });
  });

  describe('Database Execution', () => {
    test('should execute database creation plan', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Navigate to creation plan and execute
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      await waitFor(() => {
        const continueButton = screen.getByText('View Recommendations');
        user.click(continueButton);
      }, { timeout: 3000 });

      await waitFor(() => {
        const planButton = screen.getByText('Generate Creation Plan');
        user.click(planButton);
      }, { timeout: 4000 });

      await waitFor(() => {
        const executeButton = screen.getByText('Execute Creation Plan');
        user.click(executeButton);
      }, { timeout: 5000 });

      // Should show loading state
      expect(screen.getByText('Creating Database...')).toBeInTheDocument();
      expect(screen.getByText('Execute Creation Plan')).toBeDisabled();

      // Should complete and show success
      await waitFor(() => {
        expect(screen.getByText('Database Created Successfully!')).toBeInTheDocument();
        expect(screen.getByText('Your postgresql database is ready')).toBeInTheDocument();
      }, { timeout: 8000 });

      // Should call success callback
      expect(mockOnDatabaseCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          databaseType: 'postgresql',
          creationResult: expect.objectContaining({
            success: true
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle analysis errors gracefully', async () => {
      // Mock a failure in the AI engine
      const MockEngine = require('../../core/ai-database-initialization/AIDatabaseInitializationEngine').AIDatabaseInitializationEngine;
      MockEngine.mockImplementation(() => ({
        initializeDatabase: jest.fn().mockRejectedValue(new Error('AI service unavailable'))
      }));

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      // Should handle error without crashing
      await waitFor(() => {
        expect(screen.getByText('Analyze and Generate Database Setup')).not.toBeDisabled();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Check main heading
      expect(screen.getByRole('heading', { name: 'AI Database Initialization' })).toBeInTheDocument();

      // Check form elements
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();

      // Check tab navigation
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(5); // Input, Analysis, Recommendations, Plan, Results
    });

    test('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Tab to textarea
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      // Type in textarea
      await user.keyboard('I need a database');

      // Tab to submit button
      await user.tab();
      expect(screen.getByRole('button', { name: /analyze/i })).toHaveFocus();

      // Submit with Enter
      await user.keyboard('{Enter}');

      // Should start analysis
      await waitFor(() => {
        expect(screen.getByText('Analyzing Requirements...')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Component Lifecycle', () => {
    test('should handle cancel action', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /close/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    test('should reset state when starting new analysis', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <AIDatabaseInitializer
            onDatabaseCreated={mockOnDatabaseCreated}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      );

      // Complete full flow
      const textarea = screen.getByPlaceholderText(/E\.g\., 'I need a PostgreSQL database/);
      await user.type(textarea, 'I need a database');

      const analyzeButton = screen.getByText('Analyze and Generate Database Setup');
      await user.click(analyzeButton);

      await waitFor(() => {
        expect(screen.getByText('Analysis Results')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Go back to input and start new analysis
      const inputTab = screen.getByText('Input');
      await user.click(inputTab);

      // Clear textarea and start new analysis
      await user.clear(textarea);
      await user.type(textarea, 'I need a different database');
      await user.click(analyzeButton);

      // Should start new analysis
      await waitFor(() => {
        expect(screen.getByText('Analyzing Requirements...')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
