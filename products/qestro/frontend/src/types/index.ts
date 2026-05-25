export interface UserSubscription {
    plan?: 'free' | 'pro' | 'enterprise' | string;
    aiCallsRemaining?: number;
    webRecordingsRemaining?: number;
    mobileRecordingsRemaining?: number;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user' | 'viewer' | 'developer' | 'tester' | 'manager';
    avatar?: string;
    preferences?: Record<string, unknown>;
    subscription?: UserSubscription;
    createdAt?: string;
    updatedAt?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    tokens?: AuthTokens;
    user?: User;
}

export interface LoginForm {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface AuthState {
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface SignupForm {
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
}
export interface DashboardFilters {
    status: {
        passed: boolean;
        failed: boolean;
        pending: boolean;
        running?: boolean;
    };
    environment: string;
}

export interface DateRange {
    from: string | null;
    to: string | null;
    label: string;
}

// Analytics Types
export type PlatformAnalytics = Record<string, unknown>;
export type UserAnalytics = Record<string, unknown>;
export type ProjectAnalytics = Record<string, unknown>;
export type DashboardData = Record<string, unknown>;

// Project Types
export interface Project {
    id: string;
    name: string;
    description?: string;
    type: 'mobile' | 'web' | 'api';
    status: 'active' | 'archived';
    createdAt: string;
    updatedAt: string;
}

export interface TestRun {
    id: string;
    status: 'passed' | 'failed' | 'pending' | 'running';
    environment: string;
    startedAt: string;
    endedAt?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}
