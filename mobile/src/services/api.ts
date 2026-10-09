import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { API_ROOT, REQUEST_TIMEOUT_MS } from '../config/env';
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from './secureStorage';

/**
 * Standard error shape (SRS 24.3):
 *   { status: number, code: string, message: string }
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Listener invoked when the backend rejects our token AND we cannot
 * recover by refreshing. The app subscribes to force a logout.
 */
type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

export function setOnUnauthorized(listener: UnauthorizedListener | null): void {
  onUnauthorized = listener;
}

function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axErr = error as AxiosError<any>;

    if (axErr.code === 'ECONNABORTED') {
      return new ApiError(0, 'TIMEOUT', 'Request timed out. Please try again.');
    }

    if (!axErr.response) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'Cannot reach the server. Check your internet connection.',
      );
    }

    const { status, data } = axErr.response;

    if (data && typeof data === 'object') {
      const code = typeof data.code === 'string' ? data.code : `HTTP_${status}`;
      const message =
        typeof data.message === 'string'
          ? data.message
          : 'Something went wrong.';
      return new ApiError(status, code, message);
    }

    return new ApiError(status, `HTTP_${status}`, 'Something went wrong.');
  }

  if (error instanceof Error) {
    return new ApiError(0, 'UNKNOWN', error.message);
  }

  return new ApiError(0, 'UNKNOWN', 'Something went wrong.');
}

export const http: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

http.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error)),
);

/**
 * Silent refresh.
 * Called by the response interceptor when an authenticated request returns
 * 401. Ensures only one refresh runs at a time even if many requests fail
 * simultaneously. Returns the new access token, or null if refresh failed.
 *
 * Uses a bare axios instance so this request is NOT processed by our own
 * interceptors (otherwise a 401 from refresh would recurse).
 */
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const response = await axios.post(
        `${API_ROOT}/auth/refresh`,
        { refreshToken },
        {
          timeout: REQUEST_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      const data = response.data as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!data?.accessToken || !data?.refreshToken) {
        await clearTokens();
        return null;
      }

      await saveTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      // The refresh endpoint rejected us — the refresh token is
      // expired, revoked, or reused. Session is over.
      try {
        await clearTokens();
      } catch {
        // ignore
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const apiError = normalizeError(error);

    // Retry once after a silent refresh if the access token was rejected.
    const originalRequest = (error as AxiosError).config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const isAuthFailure =
      apiError.status === 401 &&
      (apiError.code === 'INVALID_TOKEN' ||
        apiError.code === 'UNAUTHORIZED' ||
        apiError.code === 'SESSION_REVOKED');

    if (isAuthFailure && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;

      const newToken = await tryRefresh();
      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return http(originalRequest);
      }

      // Refresh failed — the session is truly over.
      if (onUnauthorized) {
        try {
          onUnauthorized();
        } catch {
          // ignore
        }
      }
    }

    return Promise.reject(apiError);
  },
);

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.get<T>(url, config);
  return res.data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.post<T>(url, body, config);
  return res.data;
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.put<T>(url, body, config);
  return res.data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.patch<T>(url, body, config);
  return res.data;
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.delete<T>(url, config);
  return res.data;
}