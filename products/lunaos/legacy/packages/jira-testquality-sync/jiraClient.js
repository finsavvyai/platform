const axios = require('axios');
const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = require('./config');

class JiraClient {
    constructor() {
        this.client = axios.create({
            baseURL: `${JIRA_BASE_URL}/rest/api/3`,
            auth: {
                username: JIRA_EMAIL,
                password: JIRA_API_TOKEN
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Get issue details including description and acceptance criteria
     * @param {string} issueKey - Jira issue key (e.g., 'PROJ-123')
     * @returns {Promise<Object>} Issue data
     */
    async getIssue(issueKey) {
        try {
            const response = await this.client.get(`/issue/${issueKey}`);
            const issue = response.data;

            // Extract description (it's in Atlassian Document Format - ADF)
            const description = this.extractDescription(issue.fields.description);

            // Extract acceptance criteria (usually in a custom field or description)
            const acceptanceCriteria = this.extractAcceptanceCriteria(issue);

            return {
                key: issue.key,
                summary: issue.fields.summary,
                description: description,
                acceptanceCriteria: acceptanceCriteria,
                issueType: issue.fields.issuetype?.name,
                status: issue.fields.status?.name,
                priority: issue.fields.priority?.name,
                labels: issue.fields.labels || [],
                rawData: issue
            };
        } catch (error) {
            console.error(`Error fetching Jira issue ${issueKey}:`, error.message);
            throw error;
        }
    }

    /**
     * Extract plain text from Atlassian Document Format (ADF)
     * @param {Object} adfContent - ADF content object
     * @returns {string} Plain text description
     */
    extractDescription(adfContent) {
        if (!adfContent) return '';

        // ADF is a complex format, this is a simplified extractor
        let text = '';

        const traverse = (node) => {
            if (node.type === 'text') {
                text += node.text;
            }
            if (node.type === 'hardBreak') {
                text += '\n';
            }
            if (node.content) {
                node.content.forEach(child => traverse(child));
                if (node.type === 'paragraph') {
                    text += '\n\n';
                }
            }
        };

        traverse(adfContent);
        return text.trim();
    }

    /**
     * Extract acceptance criteria from issue
     * Can be from custom field or parsed from description
     * @param {Object} issue - Full Jira issue object
     * @returns {string} Acceptance criteria
     */
    extractAcceptanceCriteria(issue) {
        // Try custom field first (common field names)
        const customFieldNames = [
            'customfield_10000', // Common AC field ID
            'customfield_10001',
            'customfield_10002'
        ];

        for (const fieldName of customFieldNames) {
            if (issue.fields[fieldName]) {
                return typeof issue.fields[fieldName] === 'string'
                    ? issue.fields[fieldName]
                    : this.extractDescription(issue.fields[fieldName]);
            }
        }

        // Fallback: Try to parse from description
        const description = this.extractDescription(issue.fields.description);
        const acMatch = description.match(/Acceptance Criteria[:\s]+([\s\S]*?)(?=\n\n|$)/i);
        return acMatch ? acMatch[1].trim() : '';
    }

    /**
     * Search for issues using JQL
     * @param {string} jql - JQL query string
     * @param {number} maxResults - Maximum results to return
     * @returns {Promise<Array>} Array of issue keys
     */
    async searchIssues(jql, maxResults = 50) {
        try {
            const response = await this.client.post('/search', {
                jql: jql,
                maxResults: maxResults,
                fields: ['key', 'summary']
            });

            return response.data.issues.map(issue => ({
                key: issue.key,
                summary: issue.fields.summary
            }));
        } catch (error) {
            console.error('Error searching Jira issues:', error.message);
            throw error;
        }
    }
}

module.exports = JiraClient;
