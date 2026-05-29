#!/usr/bin/env node

/**
 * SDLC.ai API Test Runner
 *
 * This script runs comprehensive API tests using the generated Postman collection.
 * It supports multiple environments, generates reports, and validates API behavior.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const ProgressBar = require('progress');
const { spawn } = require('child_process');

class APITestRunner {
    constructor(options = {}) {
        this.options = {
            baseUrl: options.baseUrl || 'http://localhost:8080/v1',
            timeout: options.timeout || 30000,
            retries: options.retries || 3,
            parallel: options.parallel || 5,
            reportDir: options.reportDir || './test-reports',
            environment: options.environment || 'development',
            verbose: options.verbose || false,
            ...options
        };

        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: [],
            warnings: [],
            metrics: {
                totalResponseTime: 0,
                minResponseTime: Infinity,
                maxResponseTime: 0,
                requests: 0
            }
        };

        this.collection = null;
        this.environment = null;
        this.jwtToken = null;
        this.testData = {
            tenant_id: '123e4567-e89b-12d3-a456-426614174000',
            user_email: 'test@example.com',
            user_password: 'TestPass123!',
            document_id: null,
            query_id: null
        };
    }

    /**
     * Initialize the test runner
     */
    async init() {
        console.log(chalk.blue.bold('\n🚀 SDLC.ai API Test Runner'));
        console.log(chalk.gray('='.repeat(50)));

        // Ensure report directory exists
        if (!fs.existsSync(this.options.reportDir)) {
            fs.mkdirSync(this.options.reportDir, { recursive: true });
        }

        // Load Postman collection
        await this.loadCollection();

        // Setup test environment
        await this.setupEnvironment();

        // Load environment variables
        this.loadEnvironmentVariables();

        console.log(chalk.green('✓ Test runner initialized\n'));
    }

    /**
     * Load Postman collection
     */
    async loadCollection() {
        try {
            const collectionPath = path.join(__dirname, '../api/postman-config.json');
            const collectionData = fs.readFileSync(collectionPath, 'utf8');
            this.collection = JSON.parse(collectionData);

            console.log(chalk.gray(`✓ Loaded collection: ${this.collection.info.name}`));
        } catch (error) {
            console.error(chalk.red('✗ Failed to load Postman collection:'), error.message);
            process.exit(1);
        }
    }

    /**
     * Setup test environment
     */
    async setupEnvironment() {
        // Create test environment
        this.environment = {
            name: 'Test Environment',
            values: [
                { key: 'base_url', value: this.options.baseUrl },
                { key: 'tenant_id', value: this.testData.tenant_id },
                { key: 'user_email', value: this.testData.user_email },
                { key: 'user_password', value: this.testData.user_password },
                { key: 'jwt_token', value: '' },
                { key: 'refresh_token', value: '' },
                { key: 'user_id', value: '' },
                { key: 'document_id', value: '' },
                { key: 'query_id', value: '' }
            ]
        };

        // Initialize HTTP client
        this.http = axios.create({
            baseURL: this.options.baseUrl,
            timeout: this.options.timeout,
            validateStatus: (status) => status < 500
        });

        // Add request interceptor
        this.http.interceptors.request.use((config) => {
            config.headers['X-Request-ID'] = this.generateRequestId();
            config.headers['X-Client-Version'] = '1.0.0';
            config.headers['X-Client-Name'] = 'api-test-runner';

            if (this.options.verbose) {
                console.log(chalk.gray(`→ ${config.method.toUpperCase()} ${config.url}`));
            }

            return config;
        });

        // Add response interceptor
        this.http.interceptors.response.use(
            (response) => {
                const responseTime = response.config.metadata?.responseTime || 0;
                this.updateMetrics(responseTime);

                if (this.options.verbose) {
                    console.log(chalk.gray(`← ${response.status} ${response.statusText} (${responseTime}ms)`));
                }

                return response;
            },
            (error) => {
                const responseTime = error.config?.metadata?.responseTime || 0;
                this.updateMetrics(responseTime);

                if (this.options.verbose) {
                    console.log(chalk.red(`✗ ${error.response?.status || 'Error'} ${error.message}`));
                }

                return Promise.reject(error);
            }
        );

        // Response timing middleware
        this.http.interceptors.request.use((config) => {
            config.metadata = { startTime: Date.now() };
            return config;
        });

        this.http.interceptors.response.use((response) => {
            const endTime = Date.now();
            response.config.metadata.responseTime = endTime - response.config.metadata.startTime;
            return response;
        });
    }

    /**
     * Load environment variables
     */
    loadEnvironmentVariables() {
        // Override with environment variables if present
        if (process.env.BASE_URL) {
            this.options.baseUrl = process.env.BASE_URL;
            this.environment.values.find(v => v.key === 'base_url').value = process.env.BASE_URL;
        }

        if (process.env.TENANT_ID) {
            this.testData.tenant_id = process.env.TENANT_ID;
            this.environment.values.find(v => v.key === 'tenant_id').value = process.env.TENANT_ID;
        }

        if (process.env.TEST_EMAIL) {
            this.testData.user_email = process.env.TEST_EMAIL;
            this.environment.values.find(v => v.key === 'user_email').value = process.env.TEST_EMAIL;
        }

        if (process.env.TEST_PASSWORD) {
            this.testData.user_password = process.env.TEST_PASSWORD;
            this.environment.values.find(v => v.key === 'user_password').value = process.env.TEST_PASSWORD;
        }
    }

    /**
     * Run all tests
     */
    async runTests() {
        const startTime = Date.now();

        console.log(chalk.blue.bold('\n📋 Running API Tests'));
        console.log(chalk.gray(`Base URL: ${this.options.baseUrl}\n`));

        try {
            // Test health endpoints first
            await this.testHealthEndpoints();

            // Run authentication tests
            await this.runAuthenticationTests();

            // Run main test suites
            await this.runTestSuites();

            // Generate report
            const duration = Date.now() - startTime;
            await this.generateReport(duration);

            // Print summary
            this.printSummary(duration);

            // Return exit code based on results
            return this.results.failed > 0 ? 1 : 0;
        } catch (error) {
            console.error(chalk.red('\n✗ Test execution failed:'), error.message);
            return 1;
        }
    }

    /**
     * Test health endpoints
     */
    async testHealthEndpoints() {
        console.log(chalk.blue('🏥 Testing Health Endpoints'));

        const healthTests = [
            { name: 'Basic Health Check', path: '/health' },
            { name: 'Readiness Check', path: '/health/ready' },
            { name: 'Liveness Check', path: '/health/live' },
            { name: 'Version Info', path: '/version' }
        ];

        for (const test of healthTests) {
            await this.runSingleTest(test, async () => {
                const response = await this.http.get(test.path);
                this.assert(response.status === 200, `Health check failed: ${test.name}`);
                this.assert(response.data, 'No response data');
                return { success: true, data: response.data };
            });
        }
    }

    /**
     * Run authentication tests
     */
    async runAuthenticationTests() {
        console.log(chalk.blue('\n🔐 Running Authentication Tests'));

        const authTests = [
            {
                name: 'Login',
                method: 'POST',
                path: '/auth/login',
                data: {
                    email: this.testData.user_email,
                    password: this.testData.user_password,
                    tenant_id: this.testData.tenant_id
                },
                expectedStatus: 200,
                postProcess: (response) => {
                    if (response.data.success && response.data.data) {
                        this.jwtToken = response.data.data.access_token;
                        this.testData.user_id = response.data.data.user.id;

                        // Update environment
                        this.environment.values.find(v => v.key === 'jwt_token').value = this.jwtToken;
                        this.environment.values.find(v => v.key === 'user_id').value = this.testData.user_id;

                        // Update HTTP client default headers
                        this.http.defaults.headers.common['Authorization'] = `Bearer ${this.jwtToken}`;

                        console.log(chalk.green('  ✓ Authentication successful'));
                    }
                }
            },
            {
                name: 'Get Current User',
                method: 'GET',
                path: '/auth/me',
                expectedStatus: 200,
                requiresAuth: true
            },
            {
                name: 'Logout',
                method: 'POST',
                path: '/auth/logout',
                expectedStatus: 200,
                requiresAuth: true,
                postProcess: () => {
                    // Clear auth token
                    this.jwtToken = null;
                    delete this.http.defaults.headers.common['Authorization'];
                }
            }
        ];

        for (const test of authTests) {
            await this.runApiTest(test);
        }
    }

    /**
     * Run test suites
     */
    async runTestSuites() {
        console.log(chalk.blue('\n📦 Running Test Suites'));

        // Re-authenticate for suite tests
        await this.authenticate();

        const suites = this.collection.item.filter(item => item.name !== 'Authentication');

        const progressBar = new ProgressBar('  [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 40,
            total: suites.reduce((sum, suite) => sum + (suite.item ? suite.item.length : 1), 0)
        });

        for (const suite of suites) {
            console.log(chalk.yellow(`\n📂 ${suite.name}`));

            if (suite.item && suite.item.length > 0) {
                for (const test of suite.item) {
                    await this.runPostmanTest(test, suite);
                    progressBar.tick();
                }
            } else {
                await this.runPostmanTest(suite);
                progressBar.tick();
            }
        }

        progressBar.terminate();
    }

    /**
     * Run a single Postman test
     */
    async runPostmanTest(test, suite = null) {
        if (!test.request) return;

        const testName = suite ? `${suite.name} - ${test.name}` : test.name;

        try {
            // Prepare request
            const config = {
                method: test.request.method || 'GET',
                url: this.interpolateVariables(test.request.url),
                headers: {},
                data: null
            };

            // Add headers
            if (test.request.header) {
                test.request.header.forEach(header => {
                    config.headers[header.key] = this.interpolateVariables(header.value);
                });
            }

            // Add body
            if (test.request.body) {
                if (test.request.body.mode === 'raw') {
                    config.data = JSON.parse(this.interpolateVariables(test.request.body.raw));
                } else if (test.request.body.mode === 'formdata') {
                    const FormData = require('form-data');
                    const form = new FormData();

                    test.request.body.formdata.forEach(field => {
                        const value = this.interpolateVariables(field.value);
                        if (field.type === 'file') {
                            // Skip file uploads in automated tests
                            return;
                        }
                        form.append(field.key, value);
                    });

                    config.data = form;
                    config.headers = { ...config.headers, ...form.getHeaders() };
                }
            }

            // Execute request
            const response = await this.http(config);

            // Run test scripts
            if (test.event) {
                for (const event of test.event) {
                    if (event.listen === 'test') {
                        await this.executeTestScript(event.script.exec, response, testName);
                    }
                }
            }

            this.results.passed++;

            if (this.options.verbose) {
                console.log(chalk.green(`  ✓ ${testName}`));
            }

        } catch (error) {
            this.results.failed++;
            this.results.errors.push({
                test: testName,
                error: error.message,
                response: error.response?.data
            });

            console.log(chalk.red(`  ✗ ${testName}: ${error.message}`));
        }
    }

    /**
     * Execute Postman test script
     */
    async executeTestScript(scriptLines, response, testName) {
        const pm = {
            response: {
                json: () => response.data,
                code: response.status,
                headers: {
                    get: (name) => response.headers[name.toLowerCase()]
                },
                responseTime: response.config.metadata?.responseTime || 0,
                responseSize: JSON.stringify(response.data).length
            },
            info: {
                requestName: testName
            },
            collectionVariables: {
                get: (key) => this.environment.values.find(v => v.key === key)?.value,
                set: (key, value) => {
                    const envVar = this.environment.values.find(v => v.key === key);
                    if (envVar) envVar.value = value;
                },
                unset: (key) => {
                    const envVar = this.environment.values.find(v => v.key === key);
                    if (envVar) envVar.value = '';
                }
            },
            test: (name, fn) => {
                try {
                    fn();
                } catch (error) {
                    throw new Error(`Test "${name}" failed: ${error.message}`);
                }
            },
            expect: require('chai').expect
        };

        // Execute script
        const script = scriptLines.join('\n');
        const func = new Function('pm', script);
        func(pm);
    }

    /**
     * Run a single test
     */
    async runSingleTest(test, testFn) {
        this.results.total++;

        try {
            const result = await testFn();

            if (result.success) {
                this.results.passed++;
                console.log(chalk.green(`  ✓ ${test.name}`));

                if (test.postProcess) {
                    await test.postProcess(result);
                }
            } else {
                this.results.failed++;
                console.log(chalk.red(`  ✗ ${test.name}: ${result.error}`));
            }
        } catch (error) {
            this.results.failed++;
            this.results.errors.push({
                test: test.name,
                error: error.message
            });
            console.log(chalk.red(`  ✗ ${test.name}: ${error.message}`));
        }
    }

    /**
     * Run an API test
     */
    async runApiTest(test) {
        await this.runSingleTest(test, async () => {
            // Check authentication requirement
            if (test.requiresAuth && !this.jwtToken) {
                throw new Error('Authentication required but no token available');
            }

            // Prepare request
            const config = {
                method: test.method,
                url: test.path,
                data: test.data,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            // Add auth header
            if (this.jwtToken) {
                config.headers.Authorization = `Bearer ${this.jwtToken}`;
            }

            // Execute request
            const response = await this.http(config);

            // Check status
            if (test.expectedStatus && response.status !== test.expectedStatus) {
                throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`);
            }

            // Post-process
            if (test.postProcess) {
                await test.postProcess(response);
            }

            return { success: true, data: response.data };
        });
    }

    /**
     * Authenticate with the API
     */
    async authenticate() {
        try {
            const response = await this.http.post('/auth/login', {
                email: this.testData.user_email,
                password: this.testData.user_password,
                tenant_id: this.testData.tenant_id
            });

            if (response.data.success && response.data.data) {
                this.jwtToken = response.data.data.access_token;
                this.testData.user_id = response.data.data.user.id;

                // Update HTTP client
                this.http.defaults.headers.common['Authorization'] = `Bearer ${this.jwtToken}`;

                console.log(chalk.green('  ✓ Re-authenticated'));
            }
        } catch (error) {
            console.error(chalk.red('  ✗ Authentication failed:'), error.message);
            throw error;
        }
    }

    /**
     * Generate test report
     */
    async generateReport(duration) {
        const reportPath = path.join(this.options.reportDir, `api-test-report-${Date.now()}.json`);

        const report = {
            timestamp: new Date().toISOString(),
            duration: duration,
            environment: this.options.environment,
            baseUrl: this.options.baseUrl,
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped,
                successRate: ((this.results.passed / this.results.total) * 100).toFixed(2) + '%'
            },
            metrics: {
                averageResponseTime: this.results.metrics.totalResponseTime / this.results.metrics.requests,
                minResponseTime: this.results.metrics.minResponseTime,
                maxResponseTime: this.results.metrics.maxResponseTime,
                totalRequests: this.results.metrics.requests
            },
            errors: this.results.errors,
            warnings: this.results.warnings
        };

        // Write JSON report
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generateHTMLReport(report);

        console.log(chalk.blue(`\n📊 Report saved to: ${reportPath}`));
    }

    /**
     * Generate HTML report
     */
    async generateHTMLReport(report) {
        const htmlPath = path.join(this.options.reportDir, `api-test-report-${Date.now()}.html`);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SDLC.ai API Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; color: white; }
        .total { background: #3498db; }
        .passed { background: #2ecc71; }
        .failed { background: #e74c3c; }
        .rate { background: #9b59b6; }
        .metrics { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .errors { background: #fff5f5; border: 1px solid #fed7d7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .error-item { margin: 10px 0; padding: 10px; background: white; border-left: 4px solid #e74c3c; }
        .timestamp { color: #7f8c8d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 SDLC.ai API Test Report</h1>
        <p class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</p>

        <div class="summary">
            <div class="summary-card total">
                <h2>${report.summary.total}</h2>
                <p>Total Tests</p>
            </div>
            <div class="summary-card passed">
                <h2>${report.summary.passed}</h2>
                <p>Passed</p>
            </div>
            <div class="summary-card failed">
                <h2>${report.summary.failed}</h2>
                <p>Failed</p>
            </div>
            <div class="summary-card rate">
                <h2>${report.summary.successRate}</h2>
                <p>Success Rate</p>
            </div>
        </div>

        <div class="metrics">
            <h3>📊 Performance Metrics</h3>
            <p><strong>Duration:</strong> ${(report.duration / 1000).toFixed(2)} seconds</p>
            <p><strong>Average Response Time:</strong> ${report.metrics.averageResponseTime.toFixed(2)}ms</p>
            <p><strong>Min Response Time:</strong> ${report.metrics.minResponseTime}ms</p>
            <p><strong>Max Response Time:</strong> ${report.metrics.maxResponseTime}ms</p>
        </div>

        ${report.errors.length > 0 ? `
        <div class="errors">
            <h3>❌ Errors (${report.errors.length})</h3>
            ${report.errors.map(error => `
                <div class="error-item">
                    <strong>${error.test}</strong>
                    <p>${error.error}</p>
                </div>
            `).join('')}
        </div>
        ` : ''}

        <p style="text-align: center; color: #7f8c8d; margin-top: 30px;">
            Report generated by SDLC.ai API Test Runner
        </p>
    </div>
</body>
</html>`;

        fs.writeFileSync(htmlPath, html);
        console.log(chalk.blue(`  HTML report: ${htmlPath}`));
    }

    /**
     * Print test summary
     */
    printSummary(duration) {
        console.log(chalk.blue.bold('\n📊 Test Summary'));
        console.log(chalk.gray('='.repeat(50)));

        const table = new Table({
            head: ['Metric', 'Value'],
            colWidths: [20, 20]
        });

        table.push(
            ['Total Tests', this.results.total],
            ['Passed', chalk.green(this.results.passed)],
            ['Failed', chalk.red(this.results.failed)],
            ['Skipped', chalk.yellow(this.results.skipped)],
            ['Success Rate', `${((this.results.passed / this.results.total) * 100).toFixed(2)}%`],
            ['Duration', `${(duration / 1000).toFixed(2)}s`],
            ['Avg Response Time', `${(this.results.metrics.totalResponseTime / this.results.metrics.requests).toFixed(2)}ms`]
        );

        console.log(table.toString());

        if (this.results.errors.length > 0) {
            console.log(chalk.red.bold('\n❌ Errors:'));
            this.results.errors.slice(0, 5).forEach(error => {
                console.log(chalk.red(`  • ${error.test}: ${error.error}`));
            });

            if (this.results.errors.length > 5) {
                console.log(chalk.gray(`  ... and ${this.results.errors.length - 5} more errors`));
            }
        }

        console.log('\n');
    }

    /**
     * Helper methods
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    interpolateVariables(str) {
        if (typeof str !== 'string') return str;

        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = this.environment.values.find(v => v.key === key)?.value;
            return value || match;
        });
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateMetrics(responseTime) {
        this.results.metrics.requests++;
        this.results.metrics.totalResponseTime += responseTime;
        this.results.metrics.minResponseTime = Math.min(this.results.metrics.minResponseTime, responseTime);
        this.results.metrics.maxResponseTime = Math.max(this.results.metrics.maxResponseTime, responseTime);
    }
}

// CLI interface
if (require.main === module) {
    const args = require('yargs')
        .usage('Usage: $0 [options]')
        .option('base-url', {
            alias: 'u',
            type: 'string',
            default: 'http://localhost:8080/v1',
            description: 'API base URL'
        })
        .option('timeout', {
            alias: 't',
            type: 'number',
            default: 30000,
            description: 'Request timeout in milliseconds'
        })
        .option('parallel', {
            alias: 'p',
            type: 'number',
            default: 5,
            description: 'Number of parallel requests'
        })
        .option('report-dir', {
            alias: 'r',
            type: 'string',
            default: './test-reports',
            description: 'Report output directory'
        })
        .option('environment', {
            alias: 'e',
            type: 'string',
            default: 'development',
            description: 'Test environment'
        })
        .option('verbose', {
            alias: 'v',
            type: 'boolean',
            description: 'Verbose output'
        })
        .help('h')
        .argv;

    // Run tests
    const runner = new APITestRunner(args);

    runner.init()
        .then(() => runner.runTests())
        .then(exitCode => process.exit(exitCode))
        .catch(error => {
            console.error(chalk.red('\n✗ Fatal error:'), error.message);
            process.exit(1);
        });
}

module.exports = APITestRunner;
