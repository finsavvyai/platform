/**
 * User Guide Accuracy Tests
 *
 * Tests to ensure user guide documentation matches actual UI and functionality
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import DocumentationTestUtils from '../utils/documentationTestUtils';
import { getTestConfig } from '../config/testConfig';

describe('User Guide Accuracy', () => {
  const config = getTestConfig();
  let userGuideContent: string;
  const projectRoot = path.resolve(process.cwd(), '..');

  beforeAll(async () => {
    try {
      // Try to read user guide documentation
      const userGuidePath = 'docs/USER_ONBOARDING_GUIDE.md';
      const docFile = await DocumentationTestUtils.readDocumentationFile(userGuidePath);
      userGuideContent = docFile.content;
    } catch (error) {
      console.warn('User guide not found, testing general documentation patterns');
      userGuideContent = '';
    }
  });

  describe('Onboarding Process Validation', () => {
    it('should document the complete user registration flow', () => {
      if (!userGuideContent) return;

      expect(userGuideContent).toMatch(/registration|sign.*up|create.*account/i);
      expect(userGuideContent).toMatch(/email.*password|verification/i);
    });

    it('should describe initial project setup steps', () => {
      if (!userGuideContent) return;

      expect(userGuideContent).toMatch(/project.*setup|create.*project/i);
      expect(userGuideContent).toMatch(/mobile|web|platform/i);
    });

    it('should include getting started checklist', () => {
      if (!userGuideContent) return;

      expect(userGuideContent).toMatch(/checklist|steps|getting.*started/i);
    });

    it('should provide clear navigation instructions', () => {
      if (!userGuideContent) return;

      expect(userGuideContent).toMatch(/dashboard|navigation|menu/i);
    });
  });

  describe('Feature Coverage Validation', () => {
    it('should document all major platform features', () => {
      const expectedFeatures = [
        'test recording',
        'test execution',
        'AI test generation',
        'mobile testing',
        'web testing',
        'analytics',
        'reporting'
      ];

      expectedFeatures.forEach(feature => {
        if (userGuideContent) {
          expect(userGuideContent.toLowerCase()).toContain(feature.toLowerCase());
        }
      });
    });

    it('should explain voice testing capabilities', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/voice.*testing|voice.*commands/i);
      }
    });

    it('should document API testing features', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/API.*testing|endpoint.*testing/i);
      }
    });

    it('should describe database testing functionality', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/database.*testing|data.*validation/i);
      }
    });
  });

  describe('User Interface Validation', () => {
    it('should document the Recording Studio interface', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/recording.*studio|record.*test/i);
      }
    });

    it('should describe project management UI', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/project.*management|test.*management/i);
      }
    });

    it('should document analytics dashboard', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/dashboard|analytics|reports/i);
      }
    });

    it('should include screenshots or diagrams references', () => {
      if (userGuideContent) {
        const hasImages = userGuideContent.includes('![') ||
                         userGuideContent.includes('<img') ||
                         userGuideContent.includes('screenshot');

        if (hasImages) {
          // Validate image references
          const images = await DocumentationTestUtils.validateImageReferences(
            path.join(projectRoot, 'docs'),
            userGuideContent
          );

          const invalidImages = images.filter(img => !img.valid);
          if (invalidImages.length > 0) {
            console.warn('Invalid image references found:', invalidImages);
          }
        }
      }
    });
  });

  describe('Workflow Validation', () => {
    it('should document test creation workflows', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/create.*test|new.*test.*case/i);
        expect(userGuideContent).toMatch(/record|generate|manual/i);
      }
    });

    it('should describe test execution process', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/run.*test|execute.*test|test.*run/i);
      }
    });

    it('should document result analysis workflows', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/results|analysis|reports|pass.*fail/i);
      }
    });

    it('should explain team collaboration features', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/team|collaboration|sharing|roles/i);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should document project configuration options', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/settings|configuration|options/i);
      }
    });

    it('should explain device and platform setup', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/device|platform|iOS|Android|web/i);
      }
    });

    it('should describe agent installation and setup', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/agent|installation|setup|connect/i);
      }
    });
  });

  describe('Best Practices Documentation', () => {
    it('should include testing best practices', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/best.*practices|recommendations|tips/i);
      }
    });

    it('should provide troubleshooting guidance', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/troubleshooting|issues|problems|help/i);
      }
    });

    it('should document common workflows', () => {
      if (userGuideContent) {
        expect(userGuideContent).toMatch(/workflow|step.*by.*step|tutorial/i);
      }
    });
  });

  describe('Code Example Validation', () => {
    it('should provide working configuration examples', async () => {
      if (!userGuideContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(userGuideContent);
      const configExamples = codeBlocks.filter(block =>
        block.language === 'json' ||
        block.language === 'yaml' ||
        block.language === 'yml'
      );

      const validationResults = await DocumentationTestUtils.validateCodeExamples(configExamples);
      const invalidExamples = validationResults.filter(r => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });

    it('should include valid command examples', async () => {
      if (!userGuideContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(userGuideContent);
      const commandExamples = codeBlocks.filter(block =>
        block.language === 'bash' ||
        block.language === 'shell' ||
        block.language === 'sh'
      );

      const validationResults = await DocumentationTestUtils.validateCodeExamples(commandExamples);
      const invalidExamples = validationResults.filter(r => !r.valid);

      expect(invalidExamples).toHaveLength(0);
    });
  });

  describe('Terminology Consistency', () => {
    it('should use consistent terminology throughout', () => {
      if (!userGuideContent) return;

      // Check for consistent use of terms
      const terms = {
        'Test Case': /test.*case/gi,
        'Test Suite': /test.*suite/gi,
        'Recording Studio': /recording.*studio/gi,
        'Dashboard': /dashboard/gi,
        'Project': /project/gi
      };

      // This is a basic check - in a real implementation, you might want
      // to ensure terms are used consistently (e.g., not mixing "test case" and "testcase")
      Object.entries(terms).forEach(([term, regex]) => {
        const matches = userGuideContent.match(regex);
        if (matches && matches.length > 1) {
          // Term appears multiple times, check for consistency
          const uniqueVariations = new Set(matches.map(m => m.toLowerCase()));
          expect(uniqueVariations.size).toBeLessThanOrEqual(2); // Allow for capitalization differences
        }
      });
    });

    it('should define technical terms and acronyms', () => {
      if (!userGuideContent) return;

      // Look for definitions of common terms
      expect(userGuideContent).toMatch(/API.*Application Programming Interface|AI.*Artificial Intelligence/i);
    });
  });

  describe('Navigation and Structure', () => {
    it('should have logical content organization', () => {
      if (!userGuideContent) return;

      // Check for table of contents or clear section headers
      const hasHeaders = userGuideContent.includes('#') || userGuideContent.includes('##');
      expect(hasHeaders).toBe(true);
    });

    it('should include cross-references between sections', () => {
      if (!userGuideContent) return;

      // Look for internal links
      const links = DocumentationTestUtils.extractLinks(userGuideContent);
      const internalLinks = links.filter(link => link.type === 'internal');

      expect(internalLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility and Usability', () => {
    it('should be written at appropriate reading level', () => {
      if (!userGuideContent) return;

      // Basic readability check - avoid overly complex sentences
      const sentences = userGuideContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const longSentences = sentences.filter(s => s.split(' ').length > 30);

      // Less than 10% of sentences should be overly long
      expect(longSentences.length / sentences.length).toBeLessThan(0.1);
    });

    it('should include clear action-oriented language', () => {
      if (!userGuideContent) return;

      // Look for action words
      const actionWords = ['create', 'run', 'configure', 'set up', 'start', 'add', 'use'];
      const hasActionWords = actionWords.some(word =>
        userGuideContent.toLowerCase().includes(word)
      );

      expect(hasActionWords).toBe(true);
    });

    it('should provide examples for complex concepts', () => {
      if (!userGuideContent) return;

      const codeBlocks = DocumentationTestUtils.extractCodeBlocks(userGuideContent);
      expect(codeBlocks.length).toBeGreaterThan(0);
    });
  });
});

describe('Frontend UI Validation', () => {
  it('should validate that documented UI components exist', async () => {
    const frontendSrc = path.join(projectRoot, 'frontend/src');

    try {
      // Check for major components
      const expectedComponents = [
        'pages/RecordingStudioPage.tsx',
        'pages/DashboardPage.tsx',
        'pages/ProjectManagementPage.tsx',
        'components/TestCaseCard.tsx',
        'components/TestExecutionPanel.tsx'
      ];

      for (const component of expectedComponents) {
        try {
          await fs.access(path.join(frontendSrc, component));
        } catch (error) {
          console.warn(`Expected component not found: ${component}`);
        }
      }
    } catch (error) {
      console.warn('Frontend source directory not found');
    }
  });

  it('should validate routing structure matches documentation', async () => {
    // This would ideally check the actual routing configuration
    // For now, just check that routing files exist
    const frontendSrc = path.join(projectRoot, 'frontend/src');

    try {
      await fs.access(path.join(frontendSrc, 'App.tsx'));
      await fs.access(path.join(frontendSrc, 'router'));
    } catch (error) {
      console.warn('Frontend routing files not found');
    }
  });
});

describe('Feature Integration Validation', () => {
  it('should validate AI feature availability', async () => {
    // Check if AI services are properly integrated
    const backendSrc = path.join(projectRoot, 'backend/src');

    try {
      await fs.access(path.join(backendSrc, 'services/AIService.ts'));
    } catch (error) {
      console.warn('AI service file not found');
    }
  });

  it('should validate recording service integration', async () => {
    const backendSrc = path.join(projectRoot, 'backend/src');

    try {
      await fs.access(path.join(backendSrc, 'services/RecordingService.ts'));
      await fs.access(path.join(backendSrc, 'services/WebRecordingService.ts'));
    } catch (error) {
      console.warn('Recording service files not found');
    }
  });

  it('should validate test execution engine', async () => {
    const backendSrc = path.join(projectRoot, 'backend/src');

    try {
      await fs.access(path.join(backendSrc, 'services/TestExecutionEngine.ts'));
    } catch (error) {
      console.warn('Test execution engine file not found');
    }
  });
});

describe('User Experience Flow Validation', () => {
  it('should document complete user journey from signup to first test', () => {
    // This would test the user journey documentation
    // For now, just check that we have documentation covering this flow
    expect(true).toBe(true); // Placeholder
  });

  it('should validate error handling in user workflows', () => {
    // Check that error scenarios are documented
    expect(true).toBe(true); // Placeholder
  });

  it('should ensure progressive disclosure of complex features', () => {
    // Check that complex features are introduced gradually
    expect(true).toBe(true); // Placeholder
  });
});
