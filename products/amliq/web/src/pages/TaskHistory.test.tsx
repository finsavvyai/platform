import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TaskHistory } from './TaskHistory';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));
vi.mock('../components/layout/PageHeader', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}));
vi.mock('../components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div>Loading</div>,
}));
vi.mock('../components/tasks/TaskTable', () => ({
  TaskTable: ({ tasks }: any) => <div>TaskTable: {tasks.length}</div>,
}));
vi.mock('../components/tasks/TaskMobileList', () => ({
  TaskMobileList: ({ tasks }: any) => <div>TaskMobileList: {tasks.length}</div>,
}));
vi.mock('../components/tasks/AlertSettings', () => ({
  AlertSettings: ({ onSave }: any) => <div><span>AlertSettings</span><button onClick={onSave}>Save alerts</button></div>,
}));

const mockTask = { id: 't1', task_name: 'sanctions_sync', trigger: 'cron', status: 'success' as const, started_at: '2026-01-01', duration_ms: 1200 };

beforeEach(() => { vi.clearAllMocks() });

describe('TaskHistory', () => {
  it('shows loading spinner initially', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    render(<TaskHistory />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', async () => {
    vi.mocked(api.get).mockResolvedValue({ tasks: [] });
    render(<TaskHistory />);
    await waitFor(() => expect(screen.getByText(/no task history/i)).toBeInTheDocument());
  });

  it('renders task table with tasks', async () => {
    vi.mocked(api.get).mockResolvedValue({ tasks: [mockTask] });
    render(<TaskHistory />);
    await waitFor(() => expect(screen.getByText('TaskTable: 1')).toBeInTheDocument());
  });

  it('toggles alert settings panel', async () => {
    vi.mocked(api.get).mockResolvedValue({ tasks: [] });
    render(<TaskHistory />);
    await waitFor(() => screen.getByText(/no task history/i));
    await userEvent.click(screen.getByRole('button', { name: /alert settings/i }));
    expect(screen.getByText('AlertSettings')).toBeInTheDocument();
  });

  it('saves alert config and closes panel', async () => {
    vi.mocked(api.get).mockResolvedValue({ tasks: [] });
    vi.mocked(api.put).mockResolvedValue({});
    render(<TaskHistory />);
    await waitFor(() => screen.getByText(/no task history/i));
    await userEvent.click(screen.getByRole('button', { name: /alert settings/i }));
    await userEvent.click(screen.getByRole('button', { name: /save alerts/i }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/tasks/alerts', expect.any(Object)));
    expect(screen.queryByText('AlertSettings')).not.toBeInTheDocument();
  });
});
