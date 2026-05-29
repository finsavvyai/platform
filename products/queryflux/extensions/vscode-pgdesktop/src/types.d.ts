// Type declarations for missing global types

// Fix for axios RequestInit issue
declare global {
    interface RequestInit {
        body?: BodyInit | null;
        headers?: HeadersInit;
        method?: string;
        signal?: AbortSignal | null;
    }
}

export {};
