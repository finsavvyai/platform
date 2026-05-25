const axios = require('axios');
const { TESTQUALITY_BASE_URL, TESTQUALITY_TOKEN, TESTQUALITY_PROJECT_ID } = require('./config');

class TestQualityClient {
    constructor() {
        this.client = axios.create({
            baseURL: TESTQUALITY_BASE_URL,
            headers: {
                'Authorization': `Bearer ${TESTQUALITY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        this.projectId = TESTQUALITY_PROJECT_ID;
    }

    /**
     * Get the root plan for the project
     * @returns {Promise<Object>} Root plan data
     */
    async getRootPlan() {
        try {
            const response = await this.client.get('/plan', {
                params: {
                    project_id: this.projectId,
                    is_root: true
                }
            });
            return response.data[0]; // First item is root plan
        } catch (error) {
            console.error('Error fetching root plan:', error.message);
            throw error;
        }
    }

    /**
     * Create or get a folder/suite for organizing test cases
     * @param {string} folderName - Name of the folder
     * @param {number} parentId - ID of parent folder (use root plan ID)
     * @param {number} planId - ID of the plan
     * @returns {Promise<Object>} Folder data
     */
    async createFolder(folderName, parentId, planId) {
        try {
            // First check if folder exists
            const existingFolders = await this.getFolders();
            const existing = existingFolders.find(f => f.name === folderName);
            if (existing) {
                return existing;
            }

            const response = await this.client.post('/suite', {
                name: folderName,
                parent_id: parentId,
                plan_id: planId,
                sequence_plan: 1
            });
            return response.data[0];
        } catch (error) {
            console.error('Error creating folder:', error.message);
            throw error;
        }
    }

    /**
     * Get all folders in the project
     * @returns {Promise<Array>} Array of folders
     */
    async getFolders() {
        try {
            const response = await this.client.get('/suite', {
                params: {
                    project_id: this.projectId
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching folders:', error.message);
            return [];
        }
    }

    /**
     * Create a test case
     * @param {Object} testData - Test case data
     * @param {string} testData.name - Test case name
     * @param {string} testData.description - Test case description
     * @param {string} testData.preconditions - Test preconditions
     * @param {number} testData.suiteId - Suite/folder ID
     * @param {string} testData.jiraKey - Jira issue key for linking
     * @returns {Promise<Object>} Created test case
     */
    async createTestCase(testData) {
        try {
            const response = await this.client.post('/test', {
                name: testData.name,
                description: testData.description || '',
                preconditions: testData.preconditions || '',
                suite_id: testData.suiteId,
                external_issue_id: testData.jiraKey // Link to Jira
            });

            const testCase = response.data[0];

            // Add steps if provided
            if (testData.steps && testData.steps.length > 0) {
                await this.addStepsToTest(testCase.id, testData.steps);
            }

            return testCase;
        } catch (error) {
            console.error('Error creating test case:', error.message);
            throw error;
        }
    }

    /**
     * Add steps to a test case
     * @param {number} testId - Test case ID
     * @param {Array<Object>} steps - Array of step objects
     * @returns {Promise<Array>} Created steps
     */
    async addStepsToTest(testId, steps) {
        try {
            const createdSteps = [];
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const response = await this.client.post('/test_step', {
                    test_id: testId,
                    sequence: i + 1,
                    description: step.description || step.action || '',
                    expected_result: step.expectedResult || step.expected || ''
                });
                createdSteps.push(response.data[0]);
            }
            return createdSteps;
        } catch (error) {
            console.error('Error adding steps:', error.message);
            throw error;
        }
    }

    /**
     * Update an existing test case
     * @param {number} testId - Test case ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated test case
     */
    async updateTestCase(testId, updates) {
        try {
            const response = await this.client.put(`/test/${testId}`, updates);
            return response.data[0];
        } catch (error) {
            console.error('Error updating test case:', error.message);
            throw error;
        }
    }

    /**
     * Find test cases by external issue ID (Jira key)
     * @param {string} jiraKey - Jira issue key
     * @returns {Promise<Array>} Matching test cases
     */
    async findTestsByJiraKey(jiraKey) {
        try {
            const response = await this.client.get('/test', {
                params: {
                    project_id: this.projectId,
                    external_issue_id: jiraKey
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error finding tests by Jira key:', error.message);
            return [];
        }
    }
}

module.exports = TestQualityClient;
