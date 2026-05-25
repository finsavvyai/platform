import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import workflowReducer from './slices/workflowSlice';
import agentReducer from './slices/agentSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    workflows: workflowReducer,
    agents: agentReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;