import { Router } from 'express';
import { getStubs, createStub, deleteStub, resetStubs, getRequests } from '../controllers/MockController.js';

const router = Router();

// Get all mocks
router.get('/', getStubs);

// Create a new mock stub
router.post('/', createStub);

// Delete a mock stub
router.delete('/:id', deleteStub);

// Reset all mocks
router.post('/reset', resetStubs);

// Get received requests (for verification)
router.get('/requests', getRequests);

export default router;
