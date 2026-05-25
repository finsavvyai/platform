require('dotenv').config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL || 'https://your-domain.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const TESTQUALITY_BASE_URL = 'https://api.testquality.com/api';
const TESTQUALITY_TOKEN = process.env.TESTQUALITY_TOKEN;
const TESTQUALITY_PROJECT_ID = process.env.TESTQUALITY_PROJECT_ID;

module.exports = {
    JIRA_BASE_URL,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    TESTQUALITY_BASE_URL,
    TESTQUALITY_TOKEN,
    TESTQUALITY_PROJECT_ID
};
