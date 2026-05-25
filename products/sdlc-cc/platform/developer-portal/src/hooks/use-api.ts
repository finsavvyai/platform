interface APIRequestOptions {
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

interface APIClient {
  request: (
    method: string,
    endpoint: string,
    options?: APIRequestOptions
  ) => Promise<unknown>
}

export function useAPI(): APIClient {
  const request = async (
    method: string,
    endpoint: string,
    options?: APIRequestOptions
  ): Promise<unknown> => {
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: method !== 'GET' ? JSON.stringify(options?.body) : undefined,
    })
    return response.json()
  }

  return { request }
}
