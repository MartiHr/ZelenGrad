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

type UploadResponse = {
  url: string;
};

const getErrorMessage = (data: unknown) => {
  if (typeof data !== "object" || data === null) {
    return "Request failed.";
  }

  const payload = data as { message?: unknown; issues?: unknown };

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.issues === "object" && payload.issues !== null) {
    for (const [field, errors] of Object.entries(payload.issues as Record<string, unknown>)) {
      if (Array.isArray(errors) && typeof errors[0] === "string") {
        return `${field}: ${errors[0]}`;
      }
    }
  }

  return "Request failed.";
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
    throw new ApiError(response.status, getErrorMessage(data));
  }

  return data as T;
};

export const uploadAssetImage = async (file: File, token: string | null) => {
  const response = await fetch(`${apiConfig.baseUrl}/uploads/assets`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: file
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, getErrorMessage(data));
  }

  return (data as UploadResponse).url;
};
