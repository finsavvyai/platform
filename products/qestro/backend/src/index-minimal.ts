/**
 * Ultra-Minimal Backend Server for AI Step Recorder
 * Only loads what's absolutely necessary
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Starting Ultra-Minimal Backend...');

const app = express();
const PORT = parseInt(process.env.PORT || '3020', 10);
const configuredOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
const allowedOrigins = new Set([
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]);
const isLocalDevOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || isLocalDevOrigin(origin) || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

console.log('📦 Loading AI Recorder routes...');

// Only load AI Step Recorder
import aiStepRecorderRoutes from './routes/ai-step-recorder.routes.js';
app.use('/api/ai-recorder', aiStepRecorderRoutes);

console.log('✅ AI Recorder routes loaded');

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
    res.json({ message: 'Qestro API - AI Recorder Mode', version: '1.0.0' });
});

app.listen(PORT, 'localhost', () => {
    console.log('');
    console.log('🚀 AI Recorder Server Started!');
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🤖 AI Recorder: http://localhost:${PORT}/api/ai-recorder`);
    console.log('');
});
