import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { fetchWorkflows, fetchWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, executeWorkflow, Workflow, WorkflowExecution } from '../../services/workflowApi';

interface WorkflowState {
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  executions: WorkflowExecution[];
  isLoading: boolean;
  error: string | null;
}

const initialState: WorkflowState = {
  workflows: [],
  currentWorkflow: null,
  executions: [],
  isLoading: false,
  error: null,
};

// Async thunks
export const loadWorkflows = createAsyncThunk(
  'workflows/loadWorkflows',
  async (_, { rejectWithValue }) => {
    try {
      const workflows = await fetchWorkflows();
      return workflows;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load workflows');
    }
  }
);

export const loadWorkflow = createAsyncThunk(
  'workflows/loadWorkflow',
  async (id: string, { rejectWithValue }) => {
    try {
      const workflow = await fetchWorkflow(id);
      return workflow;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load workflow');
    }
  }
);

export const createNewWorkflow = createAsyncThunk(
  'workflows/createWorkflow',
  async (workflowData: { name: string; description?: string; definition: any }, { rejectWithValue }) => {
    try {
      const workflow = await createWorkflow(workflowData);
      return workflow;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create workflow');
    }
  }
);

export const updateExistingWorkflow = createAsyncThunk(
  'workflows/updateWorkflow',
  async ({ id, data }: { id: string; data: Partial<Workflow> }, { rejectWithValue }) => {
    try {
      const workflow = await updateWorkflow(id, data);
      return workflow;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update workflow');
    }
  }
);

export const removeWorkflow = createAsyncThunk(
  'workflows/deleteWorkflow',
  async (id: string, { rejectWithValue }) => {
    try {
      await deleteWorkflow(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete workflow');
    }
  }
);

export const executeWorkflowAction = createAsyncThunk(
  'workflows/executeWorkflow',
  async (id: string, { rejectWithValue }) => {
    try {
      const execution = await executeWorkflow(id);
      return execution;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to execute workflow');
    }
  }
);

const workflowSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentWorkflow: (state, action: PayloadAction<Workflow | null>) => {
      state.currentWorkflow = action.payload;
    },
    addExecution: (state, action: PayloadAction<WorkflowExecution>) => {
      state.executions.push(action.payload);
    },
    updateExecution: (state, action: PayloadAction<WorkflowExecution>) => {
      const index = state.executions.findIndex(e => e.id === action.payload.id);
      if (index !== -1) {
        state.executions[index] = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Load workflows
      .addCase(loadWorkflows.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadWorkflows.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workflows = action.payload;
      })
      .addCase(loadWorkflows.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Load workflow
      .addCase(loadWorkflow.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadWorkflow.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentWorkflow = action.payload;
      })
      .addCase(loadWorkflow.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create workflow
      .addCase(createNewWorkflow.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createNewWorkflow.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workflows.push(action.payload);
        state.currentWorkflow = action.payload;
      })
      .addCase(createNewWorkflow.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update workflow
      .addCase(updateExistingWorkflow.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateExistingWorkflow.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.workflows.findIndex(w => w.id === action.payload.id);
        if (index !== -1) {
          state.workflows[index] = action.payload;
        }
        if (state.currentWorkflow?.id === action.payload.id) {
          state.currentWorkflow = action.payload;
        }
      })
      .addCase(updateExistingWorkflow.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Delete workflow
      .addCase(removeWorkflow.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeWorkflow.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workflows = state.workflows.filter(w => w.id !== action.payload);
        if (state.currentWorkflow?.id === action.payload) {
          state.currentWorkflow = null;
        }
      })
      .addCase(removeWorkflow.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Execute workflow
      .addCase(executeWorkflowAction.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(executeWorkflowAction.fulfilled, (state, action) => {
        state.isLoading = false;
        state.executions.push(action.payload);
      })
      .addCase(executeWorkflowAction.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCurrentWorkflow, addExecution, updateExecution } = workflowSlice.actions;
export default workflowSlice.reducer;


