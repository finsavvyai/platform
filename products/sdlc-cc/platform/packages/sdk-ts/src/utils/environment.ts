// Environment detection utilities

export const isNode = typeof process !== 'undefined' && process.versions?.node;
export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
export const isWebWorker = typeof self !== 'undefined' && typeof window === 'undefined';
