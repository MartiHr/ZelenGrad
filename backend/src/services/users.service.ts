import { Prisma, UserRole, type User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { hashPassword, signAuthToken, verifyPassword } from "./auth.service.js";
import type {
  AdminUpdateUserInput,
  LoginInput,
  RegisterInput,
  UpdateCurrentUserInput
} from "../validators/auth.schemas.js";

export type PublicUser = Pick<User, "id" | "email" | "name" | "role" | "greenPoints" | "isActive" | "lastLoginAt" | "createdAt" | "updatedAt">;

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  greenPoints: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export const toPublicUser = (user: PublicUser) => user;

const createAuthResponse = (user: PublicUser) => ({
  user,
  token: signAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role
  })
});

export const registerCitizen = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });

  if (existingUser) {
    throw new AppError(409, "A user with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: UserRole.CITIZEN
    },
    select: publicUserSelect
  });

  return createAuthResponse(user);
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.isActive) {
    throw new AppError(401, "Invalid email or password.");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect
  });

  return createAuthResponse(updatedUser);
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect
  });

  if (!user) {
    throw new AppError(404, "User not found.");
  }

  return user;
};

export const listUsers = async (query: { email?: string; role?: UserRole; isActive?: boolean }) => {
  return prisma.user.findMany({
    where: {
      email: query.email ? { contains: query.email, mode: "insensitive" } : undefined,
      role: query.role,
      isActive: query.isActive
    },
    orderBy: { createdAt: "desc" },
    select: publicUserSelect
  });
};

export const updateCurrentUser = async (userId: string, input: UpdateCurrentUserInput) => {
  const data: Prisma.UserUpdateInput = {
    email: input.email,
    name: input.name,
    passwordHash: input.password ? await hashPassword(input.password) : undefined
  };

  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect
  });
};

export const updateUserAsAdmin = async (userId: string, input: AdminUpdateUserInput) => {
  const data: Prisma.UserUpdateInput = {
    email: input.email,
    name: input.name,
    role: input.role,
    isActive: input.isActive,
    passwordHash: input.password ? await hashPassword(input.password) : undefined
  };

  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect
  });
};

export const deactivateUser = async (userId: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: publicUserSelect
  });
};
