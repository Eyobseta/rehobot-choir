import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

function requiredMinLength(name: string, min: number): string {
  const value = required(name);
  if (value.length < min) {
    throw new Error(
      `Environment variable ${name} must be at least ${min} characters.`,
    );
  }
  return value;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '3000')),
  host: optional('HOST', '0.0.0.0'),
  corsOrigin: optional('CORS_ORIGIN', '*'),
  logLevel: optional('LOG_LEVEL', 'info'),

  // Auth
  jwtAccessSecret: requiredMinLength('JWT_ACCESS_SECRET', 32),
  jwtRefreshSecret: requiredMinLength('JWT_REFRESH_SECRET', 32),
  jwtAccessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Storage (Cloudinary)
  cloudinaryCloudName: required('CLOUDINARY_CLOUD_NAME'),
  cloudinaryApiKey: required('CLOUDINARY_API_KEY'),
  cloudinaryApiSecret: required('CLOUDINARY_API_SECRET'),
} as const;

export type Env = typeof env;

export { required };