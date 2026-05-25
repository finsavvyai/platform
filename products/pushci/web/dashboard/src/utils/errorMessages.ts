const HTTP_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  403: 'You don\'t have permission to do that.',
  404: 'The requested resource was not found.',
  409: 'Conflict — this may already exist.',
  422: 'Validation failed. Please check your input.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Server error. Please try again later.',
  502: 'Server is temporarily unavailable.',
  503: 'Service maintenance in progress. Try again shortly.',
};

export function friendlyApiError(status: number): string {
  return HTTP_MESSAGES[status] || `Something went wrong (${status}). Please try again.`;
}

export function friendlyError(err: unknown): string {
  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return 'Network error. Please check your connection.';
  }
  if (err instanceof Error && err.message === 'Session expired') {
    return 'Session expired. Please log in again.';
  }
  if (err instanceof Error) {
    const m = err.message.match(/^API (\d{3}):/);
    if (m) return friendlyApiError(Number(m[1]));
  }
  return 'Something went wrong. Please try again.';
}
