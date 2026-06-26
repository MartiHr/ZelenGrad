export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api",
  sseUrl: import.meta.env.VITE_SSE_URL ?? "http://localhost:3000/api/events"
};

export const createDashboardEventSource = () => new EventSource(apiConfig.sseUrl);
