export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export type ApiResponse<T> = { success: true; data: T } | { success: false; error: ApiError };
