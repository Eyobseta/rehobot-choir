/**
 * Environment configuration.
 *
 * The base URL must NOT be hard-coded inside screens or services.
 * Change it here and the whole app follows.
 *
 * Development:  point to your local backend (Express running on your PC).
 *               Your physical phone must be on the same Wi-Fi network and
 *               must reach your PC by LAN IP, e.g. http://192.168.1.42:3000
 *               (NOT http://localhost:3000 — that would be the phone itself).
 *
 * Production:   point to the deployed HTTPS API.
 *               Example: https://api.rehobot-choir.example.com
 */

type AppEnv = 'development' | 'production';

// Change this to 'production' at deploy time.
const APP_ENV: AppEnv = 'development';

// ---- Configure your LAN IP here ----
// Run `ipconfig` on Windows to find the IPv4 Address of your Wi-Fi adapter.
// Example: 192.168.1.42
const DEV_LAN_IP = '192.168.19.145';
const DEV_PORT = 3000;

const DEV_BASE_URL = `http://${DEV_LAN_IP}:${DEV_PORT}`;
const PROD_BASE_URL = 'https://api.rehobot-choir.example.com';

export const API_BASE_URL = APP_ENV === 'development' ? DEV_BASE_URL : PROD_BASE_URL;

// All endpoints live under /api/v1 (SRS Section 24.1)
export const API_PREFIX = '/api/v1';

export const API_ROOT = `${API_BASE_URL}${API_PREFIX}`;

// Simple timeouts
export const REQUEST_TIMEOUT_MS = 15000;

// App metadata
export const APP_ENV_NAME = APP_ENV;