/**
 * Standalone test server for AI Step Recorder
 * This bypasses the blocking issues in the main backend
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log("Starting AI Step Recorder test server...");

const app = express();
const PORT = 3021;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'], credentials: true }));
app.use(express.json());

console.log("About to import AI Step Recorder routes...");

// Import and use the AI Step Recorder routes
import aiStepRecorderRoutes from './routes/ai-step-recorder.routes.js';
console.log("AI Step Recorder routes imported!");

app.use('/api/ai-recorder', aiStepRecorderRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ai-recorder-test-server' });
});

app.listen(PORT, 'localhost', () => {
    console.log(`🚀 AI Step Recorder Test Server running at http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api/ai-recorder`);
});
