const JiraClient = require('./jiraClient');
const TestQualityClient = require('./testQualityClient');

class JiraTestQualitySync {
    constructor() {
        this.jira = new JiraClient();
        this.testquality = new TestQualityClient();
    }

    /**
     * Sync a single Jira issue to a TestQuality test case
     * @param {string} jiraKey - Jira issue key
     * @param {number} suiteId - TestQuality suite/folder ID (optional)
     * @returns {Promise<Object>} Created/updated test case
     */
    async syncIssueToTestCase(jiraKey, suiteId = null) {
        try {
            console.log(`\n🔄 Syncing Jira issue: ${jiraKey}`);

            // 1. Fetch Jira issue
            const jiraIssue = await this.jira.getIssue(jiraKey);
            console.log(`✅ Fetched Jira issue: ${jiraIssue.summary}`);

            // 2. Check if test case already exists
            const existingTests = await this.testquality.findTestsByJiraKey(jiraKey);

            // 3. Prepare test case data
            const testData = {
                name: `[${jiraKey}] ${jiraIssue.summary}`,
                description: this.formatDescription(jiraIssue),
                preconditions: jiraIssue.description,
                suiteId: suiteId || await this.getOrCreateJiraFolder(),
                jiraKey: jiraKey,
                steps: this.parseAcceptanceCriteriaToSteps(jiraIssue.acceptanceCriteria)
            };

            let testCase;

            if (existingTests.length > 0) {
                // Update existing test case
                console.log(`📝 Updating existing test case...`);
                testCase = await this.testquality.updateTestCase(existingTests[0].id, {
                    name: testData.name,
                    description: testData.description,
                    preconditions: testData.preconditions
                });

                // Update steps if needed
                if (testData.steps.length > 0) {
                    await this.testquality.addStepsToTest(testCase.id, testData.steps);
                }
            } else {
                // Create new test case
                console.log(`✨ Creating new test case...`);
                testCase = await this.testquality.createTestCase(testData);
            }

            console.log(`✅ Test case synced successfully!`);
            return testCase;

        } catch (error) {
            console.error(`❌ Error syncing ${jiraKey}:`, error.message);
            throw error;
        }
    }

    /**
     * Sync multiple Jira issues using JQL query
     * @param {string} jql - JQL query to find issues
     * @param {number} suiteId - TestQuality suite/folder ID (optional)
     * @returns {Promise<Array>} Array of synced test cases
     */
    async syncIssuesByJQL(jql, suiteId = null) {
        try {
            console.log(`\n🔍 Searching Jira with JQL: ${jql}`);

            const issues = await this.jira.searchIssues(jql);
            console.log(`Found ${issues.length} issues to sync`);

            const results = [];
            for (const issue of issues) {
                try {
                    const testCase = await this.syncIssueToTestCase(issue.key, suiteId);
                    results.push({ success: true, jiraKey: issue.key, testCase });
                } catch (error) {
                    results.push({ success: false, jiraKey: issue.key, error: error.message });
                }
            }

            const successCount = results.filter(r => r.success).length;
            console.log(`\n✅ Sync complete: ${successCount}/${issues.length} successful`);

            return results;
        } catch (error) {
            console.error('❌ Error in bulk sync:', error.message);
            throw error;
        }
    }

    /**
     * Get or create a folder for Jira-synced test cases
     * @returns {Promise<number>} Suite ID
     */
    async getOrCreateJiraFolder() {
        const rootPlan = await this.testquality.getRootPlan();
        const folder = await this.testquality.createFolder(
            'Jira Synced Tests',
            rootPlan.default_suite_id,
            rootPlan.id
        );
        return folder.id;
    }

    /**
     * Format Jira issue data into TestQuality description
     * @param {Object} jiraIssue - Jira issue data
     * @returns {string} Formatted description
     */
    formatDescription(jiraIssue) {
        let formatted = `**Jira Issue:** ${jiraIssue.key}\n\n`;

        if (jiraIssue.description) {
            formatted += `**Description:**\n${jiraIssue.description}\n\n`;
        }

        if (jiraIssue.acceptanceCriteria) {
            formatted += `**Acceptance Criteria:**\n${jiraIssue.acceptanceCriteria}\n\n`;
        }

        formatted += `**Issue Type:** ${jiraIssue.issueType}\n`;
        formatted += `**Status:** ${jiraIssue.status}\n`;
        formatted += `**Priority:** ${jiraIssue.priority}\n`;

        if (jiraIssue.labels.length > 0) {
            formatted += `**Labels:** ${jiraIssue.labels.join(', ')}\n`;
        }

        return formatted;
    }

    /**
     * Parse acceptance criteria into test steps
     * @param {string} acceptanceCriteria - AC text
     * @returns {Array<Object>} Array of test steps
     */
    parseAcceptanceCriteriaToSteps(acceptanceCriteria) {
        if (!acceptanceCriteria) return [];

        const steps = [];
        const lines = acceptanceCriteria.split('\n');

        lines.forEach((line, index) => {
            // Look for bullet points, numbers, or "Given/When/Then" patterns
            const trimmed = line.trim();
            if (!trimmed) return;

            // Remove common prefixes
            const cleanLine = trimmed
                .replace(/^[-*•]\s*/, '')
                .replace(/^\d+\.\s*/, '')
                .replace(/^(Given|When|Then|And)\s*/i, '');

            if (cleanLine.length > 0) {
                steps.push({
                    description: cleanLine,
                    expectedResult: '' // Can be enhanced to parse expected results
                });
            }
        });

        return steps;
    }
}

module.exports = JiraTestQualitySync;
