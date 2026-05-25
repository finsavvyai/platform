#!/usr/bin/env node

/**
 * Luna GLM Vision MCP Server
 * GLM-4.5V powered GUI testing and automation agent
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LunaGLMVisionServer {
  constructor() {
    this.server = new Server(
      {
        name: 'luna-glm-vision',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.glmApiKey = process.env.GLM_API_KEY || '';
    this.glmBaseUrl = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
    this.glmModel = process.env.GLM_MODEL || 'glm-4.5v';
    this.reportsDir = process.env.GLM_TEST_REPORTS_DIR || './test-reports';

    this.setupToolHandlers();
    this.ensureReportsDirectory();
  }

  async ensureReportsDirectory() {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'glm_setup',
          description: 'Initialize and configure GLM Vision agent',
          inputSchema: {
            type: 'object',
            properties: {
              api_key: {
                type: 'string',
                description: 'GLM API key'
              },
              base_url: {
                type: 'string',
                description: 'GLM API base URL',
                default: 'https://open.bigmodel.cn/api/paas/v4'
              },
              thinking_mode: {
                type: 'boolean',
                description: 'Enable thinking mode for enhanced reasoning',
                default: true
              }
            }
          }
        },
        {
          name: 'glm_capture_screen',
          description: 'Capture and analyze screen or specific UI area',
          inputSchema: {
            type: 'object',
            properties: {
              area: {
                type: 'object',
                description: 'Specific area to capture {x, y, width, height}',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              },
              quality: {
                type: 'number',
                description: 'Screenshot quality (1-100)',
                default: 90
              },
              analyze: {
                type: 'boolean',
                description: 'Analyze captured screen with GLM-4.5V',
                default: true
              }
            }
          }
        },
        {
          name: 'glm_analyze_ui',
          description: 'Analyze UI elements and layout using GLM-4.5V',
          inputSchema: {
            type: 'object',
            properties: {
              image_path: {
                type: 'string',
                description: 'Path to screenshot image'
              },
              analysis_type: {
                type: 'string',
                enum: ['layout', 'elements', 'accessibility', 'visual_regression'],
                description: 'Type of analysis to perform',
                default: 'elements'
              },
              context: {
                type: 'string',
                description: 'Additional context for analysis'
              }
            }
          }
        },
        {
          name: 'glm_click_element',
          description: 'Click on a UI element based on visual analysis',
          inputSchema: {
            type: 'object',
            properties: {
              element_description: {
                type: 'string',
                description: 'Description of element to click (e.g., "Submit button", "Login form")'
              },
              screen_area: {
                type: 'object',
                description: 'Screen area to search in',
                properties: {
                  x: { type: 'number' },
                  y: { type: 'number' },
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              },
              confidence_threshold: {
                type: 'number',
                description: 'Minimum confidence for element detection',
                default: 0.7
              }
            },
            required: ['element_description']
          }
        },
        {
          name: 'glm_swipe_gesture',
          description: 'Perform swipe gesture on screen',
          inputSchema: {
            type: 'object',
            properties: {
              start_x: { type: 'number', description: 'Start X coordinate' },
              start_y: { type: 'number', description: 'Start Y coordinate' },
              end_x: { type: 'number', description: 'End X coordinate' },
              end_y: { type: 'number', description: 'End Y coordinate' },
              duration: { type: 'number', description: 'Duration in milliseconds', default: 500 }
            },
            required: ['start_x', 'start_y', 'end_x', 'end_y']
          }
        },
        {
          name: 'glm_type_text',
          description: 'Type text using keyboard input',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to type'
              },
              element_description: {
                type: 'string',
                description: 'Description of element to type into'
              },
              clear_first: {
                type: 'boolean',
                description: 'Clear field before typing',
                default: false
              }
            },
            required: ['text']
          }
        },
        {
          name: 'glm_run_ui_test',
          description: 'Run comprehensive UI testing workflow',
          inputSchema: {
            type: 'object',
            properties: {
              test_scenario: {
                type: 'string',
                description: 'Test scenario description'
              },
              steps: {
                type: 'array',
                description: 'Array of test steps with actions',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ['click', 'type', 'swipe', 'wait', 'capture', 'analyze'] },
                    target: { type: 'string' },
                    value: { type: 'string' },
                    parameters: { type: 'object' }
                  }
                }
              },
              generate_report: {
                type: 'boolean',
                description: 'Generate detailed test report',
                default: true
              }
            },
            required: ['test_scenario', 'steps']
          }
        },
        {
          name: 'glm_visual_regression_test',
          description: 'Compare screenshots for visual regression testing',
          inputSchema: {
            type: 'object',
            properties: {
              baseline_image: {
                type: 'string',
                description: 'Path to baseline screenshot'
              },
              current_image: {
                type: 'string',
                description: 'Path to current screenshot'
              },
              threshold: {
                type: 'number',
                description: 'Difference threshold (0-1)',
                default: 0.1
              },
              generate_diff: {
                type: 'boolean',
                description: 'Generate diff image',
                default: true
              }
            },
            required: ['baseline_image', 'current_image']
          }
        },
        {
          name: 'glm_generate_test_report',
          description: 'Generate comprehensive test report',
          inputSchema: {
            type: 'object',
            properties: {
              test_results: {
                type: 'array',
                description: 'Array of test results'
              },
              screenshots: {
                type: 'array',
                description: 'Array of screenshot paths'
              },
              format: {
                type: 'string',
                enum: ['html', 'json', 'markdown'],
                description: 'Report format',
                default: 'html'
              },
              output_path: {
                type: 'string',
                description: 'Output path for report'
              }
            },
            required: ['test_results']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'glm_setup':
            return await this.handleSetup(args);
          case 'glm_capture_screen':
            return await this.handleCaptureScreen(args);
          case 'glm_analyze_ui':
            return await this.handleAnalyzeUI(args);
          case 'glm_click_element':
            return await this.handleClickElement(args);
          case 'glm_swipe_gesture':
            return await this.handleSwipeGesture(args);
          case 'glm_type_text':
            return await this.handleTypeText(args);
          case 'glm_run_ui_test':
            return await this.handleRunUITest(args);
          case 'glm_visual_regression_test':
            return await this.handleVisualRegressionTest(args);
          case 'glm_generate_test_report':
            return await this.handleGenerateTestReport(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                stack: error.stack
              })
            }
          ]
        };
      }
    });
  }

  async handleSetup(args) {
    const { api_key, base_url, thinking_mode } = args;

    if (api_key) {
      this.glmApiKey = api_key;
    }

    if (base_url) {
      this.glmBaseUrl = base_url;
    }

    // Validate GLM API connection
    try {
      const response = await this.callGLMAPI('Test connection', []);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'GLM Vision agent setup completed',
              config: {
                api_key_set: !!this.glmApiKey,
                base_url: this.glmBaseUrl,
                model: this.glmModel,
                thinking_mode: thinking_mode || true
              },
              test_response: response
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to connect to GLM API',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleCaptureScreen(args) {
    const { area, quality = 90, analyze = true } = args;

    try {
      // Generate timestamp for filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = path.join(this.reportsDir, `screenshot-${timestamp}.png`);

      // Capture screenshot using system command
      let captureCommand = '';
      if (process.platform === 'darwin') {
        if (area) {
          captureCommand = `screencapture -R ${area.x},${area.y},${area.width},${area.height} -t png ${screenshotPath}`;
        } else {
          captureCommand = `screencapture -t png ${screenshotPath}`;
        }
      } else if (process.platform === 'win32') {
        // Windows screenshot capture would require additional setup
        throw new Error('Windows screenshot capture not implemented. Please install screenshot tool.');
      } else {
        // Linux
        if (area) {
          captureCommand = `import -window root -crop ${area.width}x${area.height}+${area.x}+${area.y} ${screenshotPath}`;
        } else {
          captureCommand = `import -window root ${screenshotPath}`;
        }
      }

      await execAsync(captureCommand);

      let analysis = null;
      if (analyze) {
        analysis = await this.callGLMAPI(
          'Analyze this screenshot and describe all visible UI elements, their positions, and any potential issues.',
          [screenshotPath]
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              screenshot_path: screenshotPath,
              area: area || 'full_screen',
              quality: quality,
              analysis: analysis
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to capture screen',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleAnalyzeUI(args) {
    const { image_path, analysis_type = 'elements', context } = args;

    try {
      let prompt = '';

      switch (analysis_type) {
        case 'layout':
          prompt = `Analyze the layout of this UI. Describe the overall structure, spacing, alignment, and any layout issues. ${context || ''}`;
          break;
        case 'elements':
          prompt = `Identify and describe all UI elements in this screenshot. Include buttons, forms, text, images, and their positions. ${context || ''}`;
          break;
        case 'accessibility':
          prompt = `Analyze this UI for accessibility issues. Check color contrast, text sizes, alt text availability, and keyboard navigation elements. ${context || ''}`;
          break;
        case 'visual_regression':
          prompt = `Analyze this UI for potential visual issues, broken elements, misalignments, or rendering problems. ${context || ''}`;
          break;
      }

      const analysis = await this.callGLMAPI(prompt, [image_path]);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              analysis_type: analysis_type,
              image_path: image_path,
              analysis: analysis
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to analyze UI',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleClickElement(args) {
    const { element_description, screen_area, confidence_threshold = 0.7 } = args;

    try {
      // First capture screen
      const captureResult = await this.handleCaptureScreen({
        area: screen_area,
        analyze: true
      });

      const captureData = JSON.parse(captureResult.content[0].text);

      if (captureData.status !== 'success') {
        throw new Error('Failed to capture screen for element detection');
      }

      // Use GLM to find element coordinates
      const findPrompt = `Find the coordinates of the "${element_description}" in this screenshot. Return the center coordinates as {x: number, y: number}. Be precise and confident.`;

      const elementDetection = await this.callGLMAPI(findPrompt, [captureData.screenshot_path]);

      // Extract coordinates from response (this would need more sophisticated parsing)
      const coordinates = this.extractCoordinates(elementDetection);

      if (!coordinates) {
        throw new Error(`Could not find element: ${element_description}`);
      }

      // Execute click using system command
      let clickCommand = '';
      if (process.platform === 'darwin') {
        clickCommand = `cliclick c:${coordinates.x},${coordinates.y}`;
      } else if (process.platform === 'win32') {
        // Windows click would require additional setup
        throw new Error('Windows click automation not implemented');
      } else {
        // Linux
        clickCommand = `xdotool mousemove ${coordinates.x} ${coordinates.y} click 1`;
      }

      await execAsync(clickCommand);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              element_description: element_description,
              coordinates: coordinates,
              action: 'click_executed'
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to click element',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleSwipeGesture(args) {
    const { start_x, start_y, end_x, end_y, duration = 500 } = args;

    try {
      let swipeCommand = '';
      if (process.platform === 'darwin') {
        swipeCommand = `cliclick dd:${start_x},${start_y} du:${end_x},${end_y}`;
      } else if (process.platform === 'win32') {
        throw new Error('Windows swipe automation not implemented');
      } else {
        // Linux
        swipeCommand = `xdotool mousemove ${start_x} ${start_y} mousedown 1 sleep 0.5 mousemove ${end_x} ${end_y} mouseup 1`;
      }

      await execAsync(swipeCommand);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              gesture: 'swipe',
              start: { x: start_x, y: start_y },
              end: { x: end_x, y: end_y },
              duration: duration
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to execute swipe gesture',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleTypeText(args) {
    const { text, element_description, clear_first = false } = args;

    try {
      let typeCommand = '';
      if (process.platform === 'darwin') {
        typeCommand = `cliclick -w 200 t:${text}`;
      } else if (process.platform === 'win32') {
        throw new Error('Windows typing automation not implemented');
      } else {
        // Linux
        typeCommand = `xdotool type "${text}"`;
      }

      if (clear_first) {
        const clearCommand = process.platform === 'darwin'
          ? 'cliclick kp:cmd-delete'
          : 'xdotool key ctrl+a Delete';
        await execAsync(clearCommand);
      }

      await execAsync(typeCommand);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              action: 'type_text',
              text: text,
              element_description: element_description,
              cleared_first: clear_first
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to type text',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleRunUITest(args) {
    const { test_scenario, steps, generate_report = true } = args;
    const testResults = [];
    const screenshots = [];

    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepResult = {
          step_number: i + 1,
          action: step.action,
          status: 'pending',
          result: null,
          error: null
        };

        try {
          switch (step.action) {
            case 'capture':
              const captureResult = await this.handleCaptureScreen(step.parameters || {});
              stepResult.result = JSON.parse(captureResult.content[0].text);
              screenshots.push(stepResult.result.screenshot_path);
              break;

            case 'analyze':
              if (screenshots.length > 0) {
                const analyzeResult = await this.handleAnalyzeUI({
                  image_path: screenshots[screenshots.length - 1],
                  ...step.parameters
                });
                stepResult.result = JSON.parse(analyzeResult.content[0].text);
              }
              break;

            case 'click':
              const clickResult = await this.handleClickElement(step.parameters);
              stepResult.result = JSON.parse(clickResult.content[0].text);
              break;

            case 'type':
              const typeResult = await this.handleTypeText(step.parameters);
              stepResult.result = JSON.parse(typeResult.content[0].text);
              break;

            case 'swipe':
              const swipeResult = await this.handleSwipeGesture(step.parameters);
              stepResult.result = JSON.parse(swipeResult.content[0].text);
              break;

            case 'wait':
              await new Promise(resolve => setTimeout(resolve, step.parameters?.duration || 1000));
              stepResult.result = { message: 'Wait completed' };
              break;

            default:
              throw new Error(`Unknown action: ${step.action}`);
          }

          stepResult.status = 'success';
        } catch (error) {
          stepResult.status = 'error';
          stepResult.error = error.message;
        }

        testResults.push(stepResult);
      }

      let reportPath = null;
      if (generate_report) {
        const reportResult = await this.handleGenerateTestReport({
          test_results: testResults,
          screenshots: screenshots,
          format: 'html'
        });
        const reportData = JSON.parse(reportResult.content[0].text);
        reportPath = reportData.report_path;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              test_scenario: test_scenario,
              total_steps: steps.length,
              successful_steps: testResults.filter(r => r.status === 'success').length,
              failed_steps: testResults.filter(r => r.status === 'error').length,
              test_results: testResults,
              screenshots: screenshots,
              report_path: reportPath
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to run UI test',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleVisualRegressionTest(args) {
    const { baseline_image, current_image, threshold = 0.1, generate_diff = true } = args;

    try {
      // Use GLM to compare images
      const comparisonPrompt = `Compare these two screenshots and identify any visual differences. Focus on UI elements, layout changes, color differences, and any regressions. Rate the similarity from 0 to 1 where 1 means identical.`;

      const comparison = await this.callGLMAPI(comparisonPrompt, [baseline_image, current_image]);

      // Parse similarity score from GLM response (this would need more sophisticated parsing)
      const similarityScore = this.extractSimilarityScore(comparison);

      const hasRegression = similarityScore < (1 - threshold);

      let diffImagePath = null;
      if (generate_diff && hasRegression) {
        // Generate diff image (would require image processing library)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        diffImagePath = path.join(this.reportsDir, `diff-${timestamp}.png`);
        // This would require implementing actual image diffing
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              baseline_image: baseline_image,
              current_image: current_image,
              similarity_score: similarityScore,
              threshold: threshold,
              has_regression: hasRegression,
              diff_image_path: diffImagePath,
              comparison_analysis: comparison
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to perform visual regression test',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async handleGenerateTestReport(args) {
    const { test_results, screenshots, format = 'html', output_path } = args;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = output_path || path.join(this.reportsDir, `test-report-${timestamp}.${format}`);

      let reportContent = '';

      switch (format) {
        case 'html':
          reportContent = this.generateHTMLReport(test_results, screenshots);
          break;
        case 'json':
          reportContent = JSON.stringify({
            generated_at: new Date().toISOString(),
            test_results: test_results,
            screenshots: screenshots
          }, null, 2);
          break;
        case 'markdown':
          reportContent = this.generateMarkdownReport(test_results, screenshots);
          break;
      }

      await fs.writeFile(reportPath, reportContent);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              format: format,
              report_path: reportPath,
              total_tests: test_results.length,
              successful_tests: test_results.filter(r => r.status === 'success').length,
              failed_tests: test_results.filter(r => r.status === 'error').length
            })
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'error',
              message: 'Failed to generate test report',
              error: error.message
            })
          }
        ]
      };
    }
  }

  async callGLMAPI(prompt, imagePaths) {
    if (!this.glmApiKey) {
      throw new Error('GLM API key not configured');
    }

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt }
        ]
      }
    ];

    // Add images to message
    for (const imagePath of imagePaths) {
      try {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');

        messages[0].content.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Image}`
          }
        });
      } catch (error) {
        console.warn(`Failed to read image ${imagePath}:`, error.message);
      }
    }

    const response = await axios.post(
      `${this.glmBaseUrl}/chat/completions`,
      {
        model: this.glmModel,
        messages: messages,
        max_tokens: 2000,
        temperature: 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${this.glmApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  extractCoordinates(response) {
    // Simple coordinate extraction - would need more robust parsing
    const coordMatch = response.match(/\{[\s]*x[\s]*:[\s]*(\d+)[\s]*,[\s]*y[\s]*:[\s]*(\d+)[\s]*\}/);
    if (coordMatch) {
      return {
        x: parseInt(coordMatch[1]),
        y: parseInt(coordMatch[2])
      };
    }
    return null;
  }

  extractSimilarityScore(response) {
    // Simple similarity score extraction - would need more robust parsing
    const scoreMatch = response.match(/(\d+\.?\d*)/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      return score > 1 ? score / 100 : score; // Normalize if percentage
    }
    return 0.5; // Default middle value
  }

  generateHTMLReport(testResults, screenshots) {
    const successCount = testResults.filter(r => r.status === 'success').length;
    const failCount = testResults.filter(r => r.status === 'error').length;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Luna GLM Vision Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .test-step { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .success { border-left: 4px solid #28a745; }
        .error { border-left: 4px solid #dc3545; }
        .screenshot { max-width: 300px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Luna GLM Vision Test Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>${testResults.length}</h3>
            <p>Total Steps</p>
        </div>
        <div class="metric">
            <h3>${successCount}</h3>
            <p>Successful</p>
        </div>
        <div class="metric">
            <h3>${failCount}</h3>
            <p>Failed</p>
        </div>
    </div>

    <h2>Test Results</h2>
    ${testResults.map(step => `
        <div class="test-step ${step.status}">
            <h3>Step ${step.step_number}: ${step.action}</h3>
            <p><strong>Status:</strong> ${step.status}</p>
            ${step.result ? `<pre>${JSON.stringify(step.result, null, 2)}</pre>` : ''}
            ${step.error ? `<p><strong>Error:</strong> ${step.error}</p>` : ''}
        </div>
    `).join('')}

    ${screenshots.length > 0 ? `
        <h2>Screenshots</h2>
        ${screenshots.map((screenshot, index) => `
            <div>
                <h4>Screenshot ${index + 1}</h4>
                <img src="${screenshot}" alt="Screenshot ${index + 1}" class="screenshot">
            </div>
        `).join('')}
    ` : ''}
</body>
</html>`;
  }

  generateMarkdownReport(testResults, screenshots) {
    const successCount = testResults.filter(r => r.status === 'success').length;
    const failCount = testResults.filter(r => r.status === 'error').length;

    return `
# Luna GLM Vision Test Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total Steps:** ${testResults.length}
- **Successful:** ${successCount}
- **Failed:** ${failCount}

## Test Results

${testResults.map(step => `
### Step ${step.step_number}: ${step.action}

**Status:** ${step.status}

${step.result ? '```json\n' + JSON.stringify(step.result, null, 2) + '\n```' : ''}
${step.error ? '**Error:** ' + step.error : ''}

---
`).join('')}

${screenshots.length > 0 ? `
## Screenshots

${screenshots.map((screenshot, index) => `
### Screenshot ${index + 1}
![Screenshot ${index + 1}](${screenshot})
`).join('')}
` : ''}
`;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Luna GLM Vision MCP server running on stdio');
  }
}

const server = new LunaGLMVisionServer();
server.run().catch(console.error);