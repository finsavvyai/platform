// Jira API Service
// Handles all Jira REST API interactions

interface JiraConnection {
    jiraUrl: string;
    jiraCloudId: string;
    accessToken: string;
}

export class JiraAPIService {
    /**
     * Get all projects from Jira
     */
    async getProjects(connection: JiraConnection): Promise<any[]> {
        const response = await this.makeRequest(
            connection,
            `/rest/api/3/project/search?maxResults=100`
        );
        return response.values || [];
    }

    /**
     * Get single project details
     */
    async getProject(connection: JiraConnection, projectKey: string): Promise<any> {
        return this.makeRequest(connection, `/rest/api/3/project/${projectKey}`);
    }

    /**
     * Get epics for a project
     */
    async getEpics(connection: JiraConnection, projectKey: string): Promise<any[]> {
        const jql = `project = ${projectKey} AND issuetype = Epic ORDER BY created DESC`;
        const response = await this.searchIssues(connection, jql);
        return response.issues || [];
    }

    /**
     * Get issues (stories, tasks, bugs) for a project
     */
    async getIssues(connection: JiraConnection, projectKey: string, options?: {
        issueTypes?: string[];
        maxResults?: number;
    }): Promise<any[]> {
        const issueTypes = options?.issueTypes || ['Story', 'Task', 'Bug'];
        const maxResults = options?.maxResults || 100;

        const jql = `project = ${projectKey} AND issuetype IN (${issueTypes.join(',')}) ORDER BY created DESC`;
        const response = await this.searchIssues(connection, jql, maxResults);
        return response.issues || [];
    }

    /**
     * Get issues for a specific epic
     */
    async getEpicIssues(connection: JiraConnection, epicKey: string): Promise<any[]> {
        const jql = `parent = ${epicKey} ORDER BY created DESC`;
        const response = await this.searchIssues(connection, jql);
        return response.issues || [];
    }

    /**
     * Get all sprints for a board
     */
    async getSprints(connection: JiraConnection, boardId: string): Promise<any[]> {
        const response = await this.makeRequest(
            connection,
            `/rest/agile/1.0/board/${boardId}/sprint?maxResults=100`
        );
        return response.values || [];
    }

    /**
     * Get issues in a sprint
     */
    async getSprintIssues(connection: JiraConnection, sprintId: string): Promise<any[]> {
        const response = await this.makeRequest(
            connection,
            `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=100`
        );
        return response.issues || [];
    }

    /**
     * Get all boards for a project
     */
    async getBoards(connection: JiraConnection, projectKeyOrId: string): Promise<any[]> {
        const response = await this.makeRequest(
            connection,
            `/rest/agile/1.0/board?projectKeyOrId=${projectKeyOrId}&maxResults=100`
        );
        return response.values || [];
    }

    /**
     * Search issues using JQL
     */
    async searchIssues(
        connection: JiraConnection,
        jql: string,
        maxResults: number = 100
    ): Promise<any> {
        return this.makeRequest(connection, `/rest/api/3/search`, {
            method: 'POST',
            body: JSON.stringify({
                jql,
                maxResults,
                fields: [
                    'summary',
                    'description',
                    'status',
                    'priority',
                    'assignee',
                    'reporter',
                    'labels',
                    'sprint',
                    'parent',
                    'issuetype',
                    'created',
                    'updated',
                    'customfield_10016', // Story points (may vary)
                ],
            }),
        });
    }

    /**
     * Get issue details
     */
    async getIssue(connection: JiraConnection, issueKey: string): Promise<any> {
        return this.makeRequest(connection, `/rest/api/3/issue/${issueKey}`);
    }

    /**
     * Get user information
     */
    async getCurrentUser(connection: JiraConnection): Promise<any> {
        return this.makeRequest(connection, `/rest/api/3/myself`);
    }

    /**
     * Make authenticated request to Jira API
     */
    private async makeRequest(
        connection: JiraConnection,
        endpoint: string,
        options?: RequestInit
    ): Promise<any> {
        const url = `${connection.jiraUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${connection.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Jira API error (${response.status}): ${error}`);
        }

        return response.json();
    }

    /**
     * Parse sprint information from Jira field
     */
    parseSprintField(sprintField: any): { id: string; name: string } | null {
        if (!sprintField || !Array.isArray(sprintField) || sprintField.length === 0) {
            return null;
        }

        // Sprint field is usually an array, get the last (current) sprint
        const sprint = sprintField[sprintField.length - 1];

        // Sprint might be a string with format: "id=123,name=Sprint 1,..."
        if (typeof sprint === 'string') {
            const idMatch = sprint.match(/id=(\d+)/);
            const nameMatch = sprint.match(/name=([^,]+)/);

            if (idMatch && nameMatch) {
                return {
                    id: idMatch[1],
                    name: nameMatch[1],
                };
            }
        }

        // Or it might be an object
        if (typeof sprint === 'object' && sprint.id && sprint.name) {
            return {
                id: String(sprint.id),
                name: sprint.name,
            };
        }

        return null;
    }

    /**
     * Extract acceptance criteria from description
     */
    extractAcceptanceCriteria(description: string | null): string | null {
        if (!description) return null;

        // Look for common acceptance criteria markers
        const markers = [
            /acceptance criteria:?\s*\n(.*?)(?=\n\n|\n[A-Z]|$)/is,
            /ac:?\s*\n(.*?)(?=\n\n|\n[A-Z]|$)/is,
            /criteria:?\s*\n(.*?)(?=\n\n|\n[A-Z]|$)/is,
        ];

        for (const marker of markers) {
            const match = description.match(marker);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }
}

export const jiraAPIService = new JiraAPIService();
