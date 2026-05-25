import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  agent_type: string;
  capabilities: string[];
  llm_config: Record<string, any>;
  tools: string[];
  status: string;
  is_enabled: boolean;
  performance_metrics: Record<string, any>;
  success_rate: number;
  average_execution_time: number;
  created_at: string;
  updated_at?: string;
  last_active?: string;
}

interface AgentState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AgentState = {
  agents: [],
  currentAgent: null,
  isLoading: false,
  error: null,
};

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Async thunks
export const loadAgents = createAsyncThunk(
  'agents/loadAgents',
  async (params?: { agent_type?: string; status?: string; is_enabled?: boolean }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.agent_type) queryParams.append('agent_type', params.agent_type);
      if (params?.status) queryParams.append('status_filter', params.status);
      if (params?.is_enabled !== undefined) queryParams.append('is_enabled', String(params.is_enabled));

      const response = await axios.get(
        `${API_BASE_URL}/agents?${queryParams.toString()}`,
        { headers: getAuthHeaders() }
      );
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to load agents');
    }
  }
);

export const loadAgent = createAsyncThunk(
  'agents/loadAgent',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/agents/${id}`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to load agent');
    }
  }
);

export const createAgent = createAsyncThunk(
  'agents/createAgent',
  async (agentData: Partial<Agent>, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/agents`, agentData, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create agent');
    }
  }
);

export const updateAgent = createAsyncThunk(
  'agents/updateAgent',
  async ({ id, data }: { id: string; data: Partial<Agent> }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/agents/${id}`, data, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update agent');
    }
  }
);

export const deleteAgent = createAsyncThunk(
  'agents/deleteAgent',
  async (id: string, { rejectWithValue }) => {
    try {
      await axios.delete(`${API_BASE_URL}/agents/${id}`, {
        headers: getAuthHeaders(),
      });
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete agent');
    }
  }
);

export const activateAgent = createAsyncThunk(
  'agents/activateAgent',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/agents/${id}/activate`, {}, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to activate agent');
    }
  }
);

export const deactivateAgent = createAsyncThunk(
  'agents/deactivateAgent',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/agents/${id}/deactivate`, {}, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to deactivate agent');
    }
  }
);

export const getAgentStatus = createAsyncThunk(
  'agents/getAgentStatus',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/agents/${id}/status`, {
        headers: getAuthHeaders(),
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to get agent status');
    }
  }
);

const agentSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentAgent: (state, action: PayloadAction<Agent | null>) => {
      state.currentAgent = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Load agents
      .addCase(loadAgents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadAgents.fulfilled, (state, action) => {
        state.isLoading = false;
        state.agents = action.payload;
      })
      .addCase(loadAgents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Load agent
      .addCase(loadAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentAgent = action.payload;
      })
      .addCase(loadAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create agent
      .addCase(createAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.agents.push(action.payload);
        state.currentAgent = action.payload;
      })
      .addCase(createAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update agent
      .addCase(updateAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.agents.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.agents[index] = action.payload;
        }
        if (state.currentAgent?.id === action.payload.id) {
          state.currentAgent = action.payload;
        }
      })
      .addCase(updateAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete agent
      .addCase(deleteAgent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteAgent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.agents = state.agents.filter(a => a.id !== action.payload);
        if (state.currentAgent?.id === action.payload) {
          state.currentAgent = null;
        }
      })
      .addCase(deleteAgent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Activate agent
      .addCase(activateAgent.fulfilled, (state, action) => {
        const index = state.agents.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.agents[index] = action.payload;
        }
        if (state.currentAgent?.id === action.payload.id) {
          state.currentAgent = action.payload;
        }
      })
      // Deactivate agent
      .addCase(deactivateAgent.fulfilled, (state, action) => {
        const index = state.agents.findIndex(a => a.id === action.payload.id);
        if (index !== -1) {
          state.agents[index] = action.payload;
        }
        if (state.currentAgent?.id === action.payload.id) {
          state.currentAgent = action.payload;
        }
      });
  },
});

export const { clearError, setCurrentAgent } = agentSlice.actions;
export default agentSlice.reducer;


