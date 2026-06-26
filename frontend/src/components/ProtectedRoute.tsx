import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";

type ProtectedRouteProps = PropsWithChildren<{
  roles?: UserRole[];
}>;

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const location = useLocation();
  const { hasRole, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <section className="page narrow">
        <h1>Loading</h1>
        <p>Checking your session.</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return children;
};
