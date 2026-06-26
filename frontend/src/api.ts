export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api",
  sseUrl: import.meta.env.VITE_SSE_URL ?? "http://localhost:3000/api/events"
};

export const createDashboardEventSource = () => new EventSource(apiConfig.sseUrl);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export const apiRequest = async <T>(path: string, options: ApiOptions = {}) => {
  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? "Request failed.");
  }

  return data as T;
};
