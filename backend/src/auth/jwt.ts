import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type AccessTokenPayload = {
  sub: string;         // user id
  role: 'MEMBER' | 'LEADER' | 'ADMIN';
  sid: string;         // session id (used for revocation)
};

export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  v: number;           // refresh-token version — used for rotation
};

function signAccess(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtAccessSecret, options);
}

function signRefresh(payload: RefreshTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.jwtRefreshSecret, options);
}

export function issueTokens(access: AccessTokenPayload, refresh: RefreshTokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccess(access),
    refreshToken: signRefresh(refresh),
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}