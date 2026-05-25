// Shared type for the internal fetch function used by all API modules
export type ApiFetchFn = (
  endpoint: string,
  options?: RequestInit
) => Promise<unknown>;
