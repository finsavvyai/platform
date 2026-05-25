import { Request, Response } from 'express';
import { wireMockService } from '../services/WireMockService';

export const getStubs = async (req: Request, res: Response) => {
    try {
        const mocks = await wireMockService.getAllStubs();
        res.json(mocks);
    } catch (err) {
        console.error('Error in getStubs:', err);
        res.status(500).json({ error: 'Failed to fetch mocks' });
    }
};

export const createStub = async (req: Request, res: Response) => {
    try {
        const stub = req.body;
        if (!stub || !stub.request || !stub.response) {
            return res.status(400).json({ error: 'Invalid stub format. Must include request and response objects.' });
        }
        const created = await wireMockService.createStub(stub);
        res.status(201).json(created);
    } catch (err) {
        console.error('Error in createStub:', err);
        res.status(500).json({ error: 'Failed to create mock' });
    }
};

export const deleteStub = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await wireMockService.deleteStub(id);
        res.json({ success: true, message: `Mock ${id} deleted` });
    } catch (err: any) {
        console.error('Error in deleteStub:', err);
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: 'Mock not found' });
        }
        res.status(500).json({ error: 'Failed to delete mock' });
    }
};

export const resetStubs = async (req: Request, res: Response) => {
    try {
        await wireMockService.reset();
        res.json({ success: true, message: 'All mocks reset' });
    } catch (err) {
        console.error('Error in resetStubs:', err);
        res.status(500).json({ error: 'Failed to reset mocks' });
    }
};

export const getRequests = async (req: Request, res: Response) => {
    try {
        const requests = await wireMockService.getRequests();
        res.json(requests);
    } catch (err) {
        console.error('Error in getRequests:', err);
        res.status(500).json({ error: 'Failed to fetch mock requests' });
    }
};
