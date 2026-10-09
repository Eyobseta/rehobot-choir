import { apiGet } from './api';

export type ServiceStatus = 'ok' | 'degraded' | 'down';

export type HealthResponse = {
  status: ServiceStatus;
  timestamp?: string;
  version?: string;
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
  };
};

/**
 * Ping the backend health endpoint.
 */
export async function checkHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}