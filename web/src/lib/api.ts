import axios from 'axios';

/**
 * Axios instance pointed at the API (proxied by Vite to the backend).
 * The access token is kept in memory and attached on each request; the
 * httpOnly refresh-token cookie is used to silently re-issue it on 401.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refresh(): Promise<string | null> {
  try {
    const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
    accessToken = data.accessToken;
    return data.accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      refreshing = refreshing ?? refresh();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

/** Extract a human-readable message from an axios error. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: { problems?: string[] } } | undefined;
    if (data?.details?.problems?.length) return data.details.problems.join(', ');
    return data?.error ?? err.message;
  }
  return 'Something went wrong';
}
