import { Router } from 'express';
import { QestroAIService } from '../services/QestroAIService.js';
import { ReviewJob } from '../workers/ai-review/types.js';
import { QA_Architect } from '../services/QA_Architect.js';
import { PersonaService } from '../services/PersonaService.js';
import { TestRepositoryManager } from '../services/TestRepositoryManager.js';
import { PolyglotReporter } from '../services/PolyglotReporter.js';

const router = Router();
const qestroAIService = QestroAIService.getInstance();
const qaArchitect = QA_Architect.getInstance();
const personaService = PersonaService.getInstance();
const curator = TestRepositoryManager.getInstance();
const reporter = PolyglotReporter.getInstance();

// Trigger a manual review (e.g., from MCP tool)
router.post('/review', async (req, res) => {
    try {
        const { prUrl, prNumber, repoOwner, repoName } = req.body;

        // Construct a job object from the request
        const job: ReviewJob = {
            id: crypto.randomUUID(),
            type: 'PR_REVIEW',
            prNumber: prNumber || 0, // Should be gathered from URL if not provided
            prTitle: 'Manual Review Trigger',
            prUrl: prUrl,
            repoOwner: repoOwner || 'unknown',
            repoName: repoName || 'unknown',
            repoUrl: prUrl, // Simplified
            prAuthor: 'user', // Triggered by user
            baseBranch: 'main',
            headBranch: 'feature',
            headSha: 'latest',
            installationId: 0,
            createdAt: new Date().toISOString()
        };

        await qestroAIService.triggerReview(job);

        res.json({ success: true, message: 'Review triggered successfully', jobId: job.id });
    } catch (error) {
        console.error('Error triggering review:', error);
        res.status(500).json({ success: false, error: 'Failed to trigger review' });
    }
});



// ... existing code ...

// Trigger a manual review ...
// ... (existing /review logic) ...

// AI Architect: Analyze a Ticket and Generate Test Plan
router.post('/ticket/analyze', async (req, res) => {
    try {
        const { ticket } = req.body; // Expects a Ticket object
        if (!ticket || !ticket.title) {
            return res.status(400).json({ success: false, error: 'Invalid ticket data' });
        }

        const plan = await qaArchitect.analyzeTicket(ticket);
        res.json({ success: true, plan });
    } catch (error) {
        console.error('Error analyzing ticket:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze ticket' });
    }
});

// The Scout: Harvest tests from a URL
router.post('/harvest/start', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: 'URL is required' });
        }

        const plan = await qaArchitect.harvestTests(url);
        res.json({ success: true, plan });
    } catch (error) {
        console.error('Error harvesting tests:', error);
        res.status(500).json({ success: false, error: 'Failed to harvest tests' });
    }
});


// ... (existing codes) ...

// The Squad: Get Persona Configuration
router.get('/persona/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const profile = personaService.getPersonaConfig(id);
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error fetching persona:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch persona' });
    }
});


// ... (existing codes) ...

// The Curator: Get Health Suggestions
router.get('/curator/suggestions', async (req, res) => {
    try {
        const suggestions = curator.getCuratorSuggestions();
        res.json({ success: true, suggestions });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch suggestions' });
    }
});

// The Curator: Record Test Execution (Internal or from Worker)
router.post('/curator/record', async (req, res) => {
    try {
        const result = req.body; // Expects TestExecutionResult
        if (!result || !result.scenarioId) {
            return res.status(400).json({ success: false, error: 'Invalid execution result' });
        }

        const report = await curator.recordExecution(result);
        res.json({ success: true, report });
    } catch (error) {
        console.error('Error recording execution:', error);
        res.status(500).json({ success: false, error: 'Failed to record execution' });
    }
});


// The Storyteller: Generate Bug Report
router.post('/reporter/bug-report', async (req, res) => {
    try {
        const { scenario, error, screenshotUrl, language } = req.body;
        if (!scenario || !error) {
            return res.status(400).json({ success: false, error: 'Invalid bug report data' });
        }

        const report = reporter.generateBugReport(scenario, error, screenshotUrl, language);
        res.json({ success: true, report });
    } catch (error) {
        console.error('Error generating bug report:', error);
        res.status(500).json({ success: false, error: 'Failed to generate bug report' });
    }
});

// The Storyteller: Generate User Manual
router.post('/reporter/manual', async (req, res) => {
    try {
        const { plan, language } = req.body;
        if (!plan) {
            return res.status(400).json({ success: false, error: 'Invalid test plan' });
        }

        const manual = reporter.generateUserManual(plan, language);
        res.json({ success: true, manual });
    } catch (error) {
        console.error('Error generating manual:', error);
        res.status(500).json({ success: false, error: 'Failed to generate manual' });
    }
});

export default router;
