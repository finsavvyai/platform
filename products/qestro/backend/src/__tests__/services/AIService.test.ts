import { jest } from '@jest/globals';
import { AIService } from '../../services/AIService.js';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => mockOpenAI),
}));

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
  });

  describe('generateTestCode', () => {
    it('should generate test code for a given scenario', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'describe("Test Scenario", () => { it("should work", () => { expect(true).toBe(true); }); });'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const scenario = {
        description: 'Test user login flow',
        platform: 'web',
        framework: 'jest',
        language: 'typescript'
      };

      const result = await aiService.generateTestCode(scenario);

      expect(result).toBeDefined();
      expect(result).toContain('describe');
      expect(result).toContain('it');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('You are a test automation expert')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Test user login flow')
          })
        ]),
        temperature: 0.3,
        max_tokens: 2000
      });
    });

    it('should handle API errors gracefully', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const scenario = {
        description: 'Test scenario',
        platform: 'web',
        framework: 'jest',
        language: 'typescript'
      };

      await expect(aiService.generateTestCode(scenario)).rejects.toThrow('API Error');
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code and provide insights', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              complexity: 'medium',
              issues: ['Missing error handling'],
              suggestions: ['Add try-catch blocks']
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const code = `
        function testFunction() {
          return true;
        }
      `;

      const result = await aiService.analyzeCode(code, 'typescript');

      expect(result).toBeDefined();
      expect(result.complexity).toBe('medium');
      expect(result.issues).toContain('Missing error handling');
      expect(result.suggestions).toContain('Add try-catch blocks');
    });

    it('should handle invalid JSON responses', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const code = 'function test() {}';

      await expect(aiService.analyzeCode(code, 'javascript')).rejects.toThrow();
    });
  });

  describe('generateNaturalLanguageTest', () => {
    it('should generate natural language test descriptions', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Given a user is on the login page, when they enter valid credentials and click login, then they should be redirected to the dashboard.'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const actions = [
        { type: 'click', selector: '#login-button' },
        { type: 'input', selector: '#email', value: 'test@example.com' },
        { type: 'input', selector: '#password', value: 'password123' }
      ];

      const result = await aiService.generateNaturalLanguageTest(actions);

      expect(result).toBeDefined();
      expect(result).toContain('Given');
      expect(result).toContain('When');
      expect(result).toContain('Then');
    });
  });

  describe('optimizeTestSuite', () => {
    it('should optimize test suite for better performance', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              optimizations: ['Parallel execution', 'Reduced setup time'],
              estimatedTimeReduction: '40%',
              recommendations: ['Use shared fixtures', 'Implement test isolation']
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const testSuite = {
        tests: [
          { name: 'Test 1', duration: 1000 },
          { name: 'Test 2', duration: 1500 }
        ],
        totalDuration: 2500
      };

      const result = await aiService.optimizeTestSuite(testSuite);

      expect(result).toBeDefined();
      expect(result.optimizations).toContain('Parallel execution');
      expect(result.estimatedTimeReduction).toBe('40%');
    });
  });

  describe('generateTestData', () => {
    it('should generate realistic test data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              users: [
                { name: 'John Doe', email: 'john@example.com', age: 30 },
                { name: 'Jane Smith', email: 'jane@example.com', age: 25 }
              ],
              products: [
                { name: 'Product 1', price: 99.99, category: 'Electronics' },
                { name: 'Product 2', price: 49.99, category: 'Books' }
              ]
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const schema = {
        users: { count: 2, fields: ['name', 'email', 'age'] },
        products: { count: 2, fields: ['name', 'price', 'category'] }
      };

      const result = await aiService.generateTestData(schema);

      expect(result).toBeDefined();
      expect(result.users).toHaveLength(2);
      expect(result.products).toHaveLength(2);
      expect(result.users[0]).toHaveProperty('name');
      expect(result.users[0]).toHaveProperty('email');
    });
  });

  describe('validateTestQuality', () => {
    it('should validate test quality and provide feedback', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              score: 85,
              feedback: ['Good test coverage', 'Consider adding edge cases'],
              improvements: ['Add negative test cases', 'Improve assertions']
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const testCode = `
        describe('User Login', () => {
          it('should login with valid credentials', () => {
            expect(login('user', 'pass')).toBe(true);
          });
        });
      `;

      const result = await aiService.validateTestQuality(testCode);

      expect(result).toBeDefined();
      expect(result.score).toBe(85);
      expect(result.feedback).toContain('Good test coverage');
      expect(result.improvements).toContain('Add negative test cases');
    });
  });
});


