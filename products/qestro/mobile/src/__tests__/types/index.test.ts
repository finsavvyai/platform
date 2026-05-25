import type {
  User,
  ApiResponse,
  LoginForm,
  SignupForm,
  Project,
  TestCase,
  AutomationRun,
  DashboardStats,
  Recording,
} from '../../types';

describe('Type Definitions', () => {
  it('should create a valid User object', () => {
    const user: User = {
      id: '1',
      email: 'test@qestro.io',
      name: 'Test User',
      role: 'admin',
    };
    expect(user.id).toBe('1');
    expect(user.role).toBe('admin');
  });

  it('should create a valid LoginForm', () => {
    const form: LoginForm = { email: 'test@qestro.io', password: 'pass123' };
    expect(form.email).toBeDefined();
    expect(form.password).toBeDefined();
  });

  it('should create a valid SignupForm', () => {
    const form: SignupForm = {
      name: 'Test',
      email: 'test@qestro.io',
      password: 'pass123',
    };
    expect(form.name).toBeDefined();
  });

  it('should create valid ApiResponse', () => {
    const response: ApiResponse<User> = {
      success: true,
      data: { id: '1', email: 'test@qestro.io', name: 'Test', role: 'user' },
    };
    expect(response.success).toBe(true);
    expect(response.data?.id).toBe('1');
  });

  it('should create valid Project', () => {
    const project: Project = {
      id: '1',
      name: 'Test Project',
      type: 'web',
      status: 'active',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(project.type).toBe('web');
  });

  it('should create valid TestCase', () => {
    const tc: TestCase = {
      id: '1',
      title: 'Login Test',
      status: 'active',
      priority: 'high',
      type: 'automated',
      projectId: 'p1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(tc.priority).toBe('high');
  });

  it('should create valid AutomationRun', () => {
    const run: AutomationRun = {
      id: '1',
      name: 'Run 1',
      status: 'running',
      projectId: 'p1',
      environment: 'staging',
      totalTests: 10,
      passedTests: 5,
      failedTests: 2,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(run.status).toBe('running');
  });

  it('should create valid DashboardStats', () => {
    const stats: DashboardStats = {
      totalTests: 100,
      passedTests: 80,
      failedTests: 15,
      pendingTests: 5,
      passRate: 84.2,
      totalRuns: 20,
      activeRuns: 2,
    };
    expect(stats.passRate).toBeCloseTo(84.2);
  });

  it('should create valid Recording', () => {
    const rec: Recording = {
      id: '1',
      name: 'Login Flow',
      url: 'https://app.example.com',
      status: 'completed',
      framework: 'playwright',
      viewport: '1920x1080',
      interactionCount: 15,
      createdAt: '2024-01-01',
    };
    expect(rec.framework).toBe('playwright');
  });
});
