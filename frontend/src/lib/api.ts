import axios, { type InternalAxiosRequestConfig } from "axios";
import { triggerAuthFailure } from "./authSignal";

// Local dev  → http://localhost:5082  (dotnet run / launchSettings.json)
// Docker     → http://localhost:9090  (set via VITE_API_BASE_URL in docker-compose.yml)
const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends HttpOnly cookies on every request automatically
  headers: { "Content-Type": "application/json" },
});

/**
 * Silent-refresh flow
 *
 * Scenario:
 *   1. User is logged in. AccessToken cookie expires after 60 min.
 *   2. Any API call returns 401.
 *   3. We call POST /api/auth/refresh-cookie — the server reads both
 *      HttpOnly cookies itself (JS can never touch them) and issues
 *      fresh cookies, revoking the old refresh token.
 *   4. We retry the original failed request (new cookie is now set).
 *   5. If the refresh also fails (token revoked / 7-day expiry hit)
 *      we clear the auth context and redirect to /login.
 *
 * Queue: if multiple requests fail at the same time we only refresh
 * once, then drain the queue by retrying all of them.
 */

type QueueItem = {
  resolve: () => void;
  reject: (err: unknown) => void;
};

let isRefreshing = false;
let queue: QueueItem[] = [];

function drainQueue(error: unknown = null) {
  queue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  );
  queue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh for 401s we haven't already retried,
    // and never for the refresh endpoint itself (avoids infinite loops).
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes("/api/auth/refresh-cookie")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Another refresh is already in flight — queue this request.
      return new Promise<void>((resolve, reject) => {
        queue.push({ resolve, reject });
      })
        .then(() => api(original))
        .catch((e) => Promise.reject(e));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      // Ask the server to rotate tokens using the HttpOnly cookies.
      await axios.post(
        `${BASE_URL}/api/auth/refresh-cookie`,
        null,
        { withCredentials: true },
      );

      drainQueue();          // let queued requests through
      return api(original);  // retry the original request
    } catch (refreshError) {
      drainQueue(refreshError);  // reject every queued request
      triggerAuthFailure();       // clears AuthContext in-memory user
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
