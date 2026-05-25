import { Page } from 'puppeteer';
import { ParameterCandidate, RecordedAction, ElementInfo } from '../types/recording.js';
import { logger } from '../utils/logger.js';
import { AIService } from './AIService.js';

export class ParameterizationService {
  private aiService: AIService;
  private detectedParameters = new Map<string, ParameterCandidate>();

  constructor() {
    this.aiService = new AIService();
  }

  async detectParameters(
    page: Page,
    actions: RecordedAction[]
  ): Promise<ParameterCandidate[]> {
    const candidates: ParameterCandidate[] = [];

    try {
      // Analyze form inputs
      const formParameters = await this.detectFormParameters(page, actions);
      candidates.push(...formParameters);

      // Analyze dynamic content
      const dynamicParameters = await this.detectDynamicContent(page, actions);
      candidates.push(...dynamicParameters);

      // Analyze URL parameters
      const urlParameters = await this.detectUrlParameters(actions);
      candidates.push(...urlParameters);

      // Use AI to enhance parameter detection
      const enhancedParameters = await this.enhanceWithAI(candidates, actions);

      // Store detected parameters
      enhancedParameters.forEach(param => {
        this.detectedParameters.set(param.selector, param);
      });

      return enhancedParameters.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error(`Failed to detect parameters: ${error}`);
      return [];
    }
  }

  private async detectFormParameters(
    page: Page,
    actions: RecordedAction[]
  ): Promise<ParameterCandidate[]> {
    const candidates: ParameterCandidate[] = [];

    // Get all form inputs from the page
    const formInputs = await page.evaluate(() => {
      const genSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ')[0]}`;
        return el.tagName.toLowerCase();
      };
      return Array.from(document.querySelectorAll('input, textarea, select')).map(input => {
        const element = input as HTMLInputElement;
        return {
          selector: genSelector(element),
          type: element.type || 'text',
          name: element.name,
          placeholder: element.placeholder,
          value: element.value,
          required: element.required,
          pattern: element.pattern,
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          labels: Array.from(document.querySelectorAll(`label[for="${element.id}"]`))
            .map(label => label.textContent?.trim())
            .filter(Boolean)
        };
      });
    });

    // Find inputs that were interacted with
    const inputActions = actions.filter(action => action.type === 'input');

    for (const input of formInputs) {
      const relatedAction = inputActions.find(action =>
        typeof action.selector === 'string' && action.selector === input.selector
      );

      if (relatedAction || this.isParameterizableInput(input)) {
        const candidate: ParameterCandidate = {
          selector: input.selector,
          element: {
            tagName: input.tagName,
            type: input.type,
            attributes: {
              name: input.name,
              id: input.id,
              class: input.className
            }
          },
          parameterType: this.getParameterType(input),
          suggestedName: this.generateParameterName(input),
          defaultValue: relatedAction?.text || input.value || input.placeholder || '',
          confidence: this.calculateInputConfidence(input, relatedAction),
          dataPattern: this.detectDataPattern(input.value || relatedAction?.text || '')
        };

        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private async detectDynamicContent(
    page: Page,
    actions: RecordedAction[]
  ): Promise<ParameterCandidate[]> {
    const candidates: ParameterCandidate[] = [];

    // Look for elements with dynamic text content
    const dynamicElements = await page.evaluate(() => {
      const elements: any[] = [];
      const genSelector = (el: Element): string => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${String(el.className).split(' ')[0]}`;
        return el.tagName.toLowerCase();
      };

      // Check for elements with timestamps
      const timestampRegex = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}(:\d{2})?/;

      // Check for elements with numbers that might be IDs or counts
      const numberRegex = /\b\d{3,}\b/;

      // Check for elements with email patterns
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

      document.querySelectorAll('*').forEach(element => {
        const text = element.textContent?.trim();
        if (!text || text.length > 100) return;

        let pattern = '';
        let paramType = 'text';

        if (timestampRegex.test(text)) {
          pattern = 'timestamp';
          paramType = 'text';
        } else if (emailRegex.test(text)) {
          pattern = 'email';
          paramType = 'text';
        } else if (numberRegex.test(text)) {
          pattern = 'number';
          paramType = 'text';
        }

        if (pattern) {
          elements.push({
            selector: genSelector(element),
            text,
            pattern,
            paramType,
            tagName: element.tagName
          });
        }
      });

      return elements;
    });

    for (const element of dynamicElements) {
      const candidate: ParameterCandidate = {
        selector: element.selector,
        element: {
          tagName: element.tagName,
          text: element.text
        },
        parameterType: 'text',
        suggestedName: this.generateDynamicParameterName(element.pattern, element.text),
        defaultValue: element.text,
        confidence: 0.6,
        dataPattern: element.pattern
      };

      candidates.push(candidate);
    }

    return candidates;
  }

  private async detectUrlParameters(actions: RecordedAction[]): Promise<ParameterCandidate[]> {
    const candidates: ParameterCandidate[] = [];

    const navigationActions = actions.filter(action => action.type === 'navigation' && action.url);

    for (const action of navigationActions) {
      if (!action.url) continue;

      try {
        const url = new URL(action.url);

        // Check query parameters
        url.searchParams.forEach((value, key) => {
          if (this.isParameterizableValue(value)) {
            const candidate: ParameterCandidate = {
              selector: `url.searchParams.${key}`,
              element: {
                tagName: 'URL',
                attributes: { parameter: key }
              },
              parameterType: 'text',
              suggestedName: key,
              defaultValue: value,
              confidence: 0.8,
              dataPattern: this.detectDataPattern(value)
            };

            candidates.push(candidate);
          }
        });

        // Check path parameters (simple detection)
        const pathSegments = url.pathname.split('/').filter(Boolean);
        pathSegments.forEach((segment, index) => {
          if (this.isParameterizableValue(segment)) {
            const candidate: ParameterCandidate = {
              selector: `url.pathname.segment[${index}]`,
              element: {
                tagName: 'URL',
                attributes: { pathSegment: index.toString() }
              },
              parameterType: 'text',
              suggestedName: `pathParam${index}`,
              defaultValue: segment,
              confidence: 0.7,
              dataPattern: this.detectDataPattern(segment)
            };

            candidates.push(candidate);
          }
        });

      } catch (error) {
        logger.debug(`Failed to parse URL: ${action.url}`);
      }
    }

    return candidates;
  }

  private async enhanceWithAI(
    candidates: ParameterCandidate[],
    actions: RecordedAction[]
  ): Promise<ParameterCandidate[]> {
    try {
      const prompt = `
        Analyze these parameter candidates for test parameterization:
        
        Actions performed: ${actions.map(a => `${a.type} on ${a.selector}`).join(', ')}
        
        Parameter candidates:
        ${candidates.map(c => `- ${c.suggestedName}: ${c.defaultValue} (${c.parameterType}, confidence: ${c.confidence})`).join('\n')}
        
        Please:
        1. Improve parameter names to be more descriptive
        2. Adjust confidence scores based on likelihood of needing parameterization
        3. Suggest better default values if applicable
        4. Identify missing parameters that should be parameterized
        
        Respond with JSON array of enhanced parameters.
      `;

      const response = await this.aiService.generateText(prompt);
      const enhanced = JSON.parse(response);

      if (Array.isArray(enhanced) && enhanced.length > 0) {
        return enhanced.map((param: any) => ({
          ...param,
          confidence: Math.min(1, Math.max(0, param.confidence || 0.5))
        }));
      }
    } catch (error) {
      logger.debug(`AI enhancement failed: ${error}`);
    }

    return candidates;
  }

  private isParameterizableInput(input: any): boolean {
    // Skip hidden inputs, passwords, and system fields
    if (input.type === 'hidden' || input.type === 'password') return false;
    if (input.name && ['csrf', 'token', '_token'].includes(input.name.toLowerCase())) return false;

    // Include inputs that are likely to need different values
    if (input.type === 'email' || input.type === 'tel' || input.type === 'url') return true;
    if (input.name && ['email', 'phone', 'name', 'username', 'search'].some(keyword =>
      input.name.toLowerCase().includes(keyword))) return true;

    // Include inputs with placeholders that suggest dynamic content
    if (input.placeholder && this.isParameterizableValue(input.placeholder)) return true;

    return false;
  }

  private isParameterizableValue(value: string): boolean {
    if (!value || value.length < 2) return false;

    // Check for patterns that suggest parameterizable content
    const patterns = [
      /\d{3,}/, // Numbers with 3+ digits (IDs, counts, etc.)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\d{4}-\d{2}-\d{2}/, // Date
      /\b(test|demo|sample|example)\b/i, // Test data indicators
      /\b\d{10,}\b/, // Long numbers (phone, ID, etc.)
    ];

    return patterns.some(pattern => pattern.test(value));
  }

  private getParameterType(input: any): 'input' | 'select' | 'checkbox' | 'radio' | 'text' {
    if (input.tagName === 'SELECT') return 'select';
    if (input.type === 'checkbox') return 'checkbox';
    if (input.type === 'radio') return 'radio';
    if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') return 'input';
    return 'text';
  }

  private generateParameterName(input: any): string {
    // Use label text if available
    if (input.labels && input.labels.length > 0) {
      return this.camelCase(input.labels[0]);
    }

    // Use name attribute
    if (input.name) {
      return this.camelCase(input.name);
    }

    // Use placeholder
    if (input.placeholder) {
      return this.camelCase(input.placeholder);
    }

    // Use ID
    if (input.id) {
      return this.camelCase(input.id);
    }

    // Fallback based on type
    return `${input.type || 'text'}Input`;
  }

  private generateDynamicParameterName(pattern: string, text: string): string {
    switch (pattern) {
      case 'timestamp':
        return 'timestamp';
      case 'email':
        return 'emailAddress';
      case 'number':
        if (text.length > 8) return 'id';
        return 'number';
      default:
        return 'dynamicText';
    }
  }

  private calculateInputConfidence(input: any, relatedAction?: RecordedAction): number {
    let confidence = 0.5;

    // Higher confidence for inputs that were actually used
    if (relatedAction) confidence += 0.3;

    // Higher confidence for common parameterizable fields
    if (input.type === 'email') confidence += 0.2;
    if (input.name && ['email', 'username', 'search', 'query'].includes(input.name.toLowerCase())) {
      confidence += 0.2;
    }

    // Higher confidence for required fields
    if (input.required) confidence += 0.1;

    // Lower confidence for system fields
    if (input.name && ['csrf', 'token'].some(keyword => input.name.toLowerCase().includes(keyword))) {
      confidence -= 0.4;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  private detectDataPattern(value: string): string {
    if (!value) return '';

    const patterns = [
      { regex: /^\d+$/, name: 'number' },
      { regex: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/, name: 'email' },
      { regex: /^\d{4}-\d{2}-\d{2}$/, name: 'date' },
      { regex: /^\d{1,2}\/\d{1,2}\/\d{4}$/, name: 'date_us' },
      { regex: /^\d{1,2}:\d{2}(:\d{2})?$/, name: 'time' },
      { regex: /^\+?[\d\s\-\(\)]+$/, name: 'phone' },
      { regex: /^https?:\/\//, name: 'url' },
      { regex: /^[A-Z0-9]{8,}$/, name: 'id_uppercase' },
      { regex: /^[a-z0-9]{8,}$/, name: 'id_lowercase' },
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(value)) {
        return pattern.name;
      }
    }

    return 'text';
  }

  private camelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, char => char.toLowerCase());
  }

  getDetectedParameters(): ParameterCandidate[] {
    return Array.from(this.detectedParameters.values());
  }

  clearDetectedParameters(): void {
    this.detectedParameters.clear();
  }

  async generateParameterizedTest(
    actions: RecordedAction[],
    parameters: ParameterCandidate[]
  ): Promise<{
    actions: RecordedAction[];
    parameters: Record<string, any>;
    testData: Array<Record<string, any>>;
  }> {
    const parameterizedActions = [...actions];
    const parameterMap: Record<string, any> = {};
    const testDataSets: Array<Record<string, any>> = [];

    // Replace values with parameter references
    for (const param of parameters) {
      parameterMap[param.suggestedName] = param.defaultValue;

      // Find and replace in actions
      parameterizedActions.forEach(action => {
        if (typeof action.selector === 'string' && action.selector === param.selector) {
          if (action.text === param.defaultValue) {
            action.text = `{{${param.suggestedName}}}`;
          }
        }
      });
    }

    // Generate sample test data sets
    testDataSets.push(parameterMap); // Default values

    // Generate variations
    for (let i = 0; i < 2; i++) {
      const variation: Record<string, any> = {};
      for (const param of parameters) {
        variation[param.suggestedName] = this.generateVariationValue(param);
      }
      testDataSets.push(variation);
    }

    return {
      actions: parameterizedActions,
      parameters: parameterMap,
      testData: testDataSets
    };
  }

  private generateVariationValue(param: ParameterCandidate): any {
    switch (param.dataPattern) {
      case 'email':
        return `test${Math.floor(Math.random() * 1000)}@example.com`;
      case 'number':
        return Math.floor(Math.random() * 10000);
      case 'phone':
        return `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      case 'date':
        const date = new Date();
        date.setDate(date.getDate() + Math.floor(Math.random() * 30));
        return date.toISOString().split('T')[0];
      case 'url':
        return `https://example${Math.floor(Math.random() * 100)}.com`;
      default:
        if (typeof param.defaultValue === 'string') {
          return `${param.defaultValue}_${Math.floor(Math.random() * 100)}`;
        }
        return param.defaultValue;
    }
  }
}

export const parameterizationService = new ParameterizationService();