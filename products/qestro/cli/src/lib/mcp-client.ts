import axios from 'axios';

export class McpClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:8080/api/v1') {
        this.baseUrl = baseUrl;
    }

    async generate(prompt: string): Promise<string> {
        try {
            // TODO: In the future, pass auth token
            const response = await axios.post(`${this.baseUrl}/generation/generate`, {
                prompt: prompt
            });
            return response.data.message || "No response from AI";
        } catch (error) {
            // Fallback for demo if server is not running
            if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
                return `[MOCK] MCPOverflow Server not reachable. \nAI says: "Here is a simulated answer for: '${prompt}'.\nTo get real answers, ensure mcpoverflow-api is running on port 8080."`;
            }
            throw error;
        }
    }
}
