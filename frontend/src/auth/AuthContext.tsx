import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { apiRequest } from "../api";
import type { AuthResponse, AuthUser, LoginInput, RegisterInput, UserRole } from "./authTypes";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
};

const tokenStorageKey = "zelengrad.auth.token";
const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const setSession = (auth: AuthResponse) => {
    localStorage.setItem(tokenStorageKey, auth.token);
    setToken(auth.token);
    setUser(auth.user);
  };

  const clearSession = () => {
    localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) {
      clearSession();
      return;
    }

    const currentUser = await apiRequest<AuthUser>("/users/me", { token });
    setUser(currentUser);
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    refreshUser()
      .catch(clearSession)
      .finally(() => setIsLoading(false));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login: async (input) => {
        setSession(await apiRequest<AuthResponse>("/login", { method: "POST", body: input }));
      },
      register: async (input) => {
        setSession(await apiRequest<AuthResponse>("/users", { method: "POST", body: input }));
      },
      logout: async () => {
        if (token) {
          await apiRequest<void>("/logout", { method: "POST", token }).catch(() => undefined);
        }

        clearSession();
      },
      refreshUser,
      hasRole: (...roles) => Boolean(user && roles.includes(user.role))
    }),
    [isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
};
