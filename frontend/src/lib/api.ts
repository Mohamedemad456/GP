import axios from "axios";
import { triggerAuthFailure } from "./authSignal";

// Local dev  → http://localhost:5082  (dotnet run / launchSettings.json)
// Docker     → http://localhost:9090  (set via VITE_API_BASE_URL in docker-compose.yml)
const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5082";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send the HttpOnly cookies on every request
  headers: { "Content-Type": "application/json" },
});

// On 401: clear the in-memory user context and send the user back to login.
// We do not attempt a token refresh here because the refresh token is in an
// HttpOnly cookie that JS cannot read, and the user said no backend changes.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      triggerAuthFailure(); // clears AuthContext user state
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
