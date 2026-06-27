import { NavLink, Outlet } from "react-router";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";
import { LiveNotifications } from "../components/LiveNotifications";

const navigation: Array<{ to: string; label: string; roles?: UserRole[] }> = [
  { to: "/", label: "Home" },
  { to: "/map", label: "Green Map" },
  { to: "/dashboard", label: "Dashboard", roles: ["MANAGER", "ADMIN"] },
  { to: "/my-forest", label: "My Forest", roles: ["CITIZEN"] },
  { to: "/worklist", label: "Worklist", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { to: "/incidents", label: "Incidents", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { to: "/zones", label: "Zones", roles: ["MANAGER", "ADMIN"] },
  { to: "/users", label: "Users", roles: ["ADMIN"] },
  { to: "/audit", label: "Audit", roles: ["ADMIN"] }
];

export const AppLayout = () => {
  const { hasRole, isAuthenticated, logout, user } = useAuth();
  const visibleNavigation = navigation.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="ZelenGrad home">
          ZelenGrad
        </NavLink>
        <nav className="nav" aria-label="Primary navigation">
          {visibleNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="session-actions">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile">
                <span>{user?.name}</span>
                <small>{user?.role}</small>
              </NavLink>
              <button type="button" onClick={() => void logout()}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
            </>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
      <LiveNotifications />
    </div>
  );
};
