import { API_URL } from './client';

export const healthApi = {
    check: async () => {
        const res = await fetch(`${API_URL}/health`);
        return res.json();
    },
};
