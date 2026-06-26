import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: string;
};

const saltRounds = 12;

export const hashPassword = (password: string) => bcrypt.hash(password, saltRounds);

export const verifyPassword = (password: string, passwordHash: string) => bcrypt.compare(password, passwordHash);

export const signAuthToken = (payload: AuthTokenPayload) => {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.jwtSecret as Secret, options);
};

export const verifyAuthToken = (token: string) => {
  return jwt.verify(token, env.jwtSecret as Secret) as AuthTokenPayload;
};
