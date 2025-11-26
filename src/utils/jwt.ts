import jwt, { SignOptions } from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

export const generateAccessToken = (payload: JwtPayload): string => {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as string | number;
  const options: SignOptions = {
    expiresIn,
  };
  return jwt.sign(payload, process.env.JWT_SECRET!, options);
};

export const generateRefreshToken = (payload: JwtPayload): string => {
  const expiresIn = (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as string | number;
  const options: SignOptions = {
    expiresIn,
  };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, options);
};

export const verifyAccessToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
};

