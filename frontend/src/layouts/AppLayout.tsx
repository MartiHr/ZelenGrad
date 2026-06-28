import type { IconName } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NavLink, Outlet } from "react-router";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";
import { LiveNotifications } from "../components/LiveNotifications";

const navigation: Array<{ to: string; label: string; icon: IconName; roles?: UserRole[] }> = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/map", label: "Green Map", icon: "map" },
  { to: "/dashboard", label: "Dashboard", icon: "gauge-high", roles: ["MANAGER", "ADMIN"] },
  { to: "/my-forest", label: "My Forest", icon: "tree", roles: ["CITIZEN"] },
  { to: "/worklist", label: "Worklist", icon: "list-check", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { to: "/incidents", label: "Incidents", icon: "triangle-exclamation", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { to: "/zones", label: "Zones", icon: "draw-polygon", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { to: "/users", label: "Users", icon: "users", roles: ["ADMIN"] },
  { to: "/audit", label: "Audit", icon: "clipboard-list", roles: ["ADMIN"] }
];

export const AppLayout = () => {
  const { hasRole, isAuthenticated, logout, user } = useAuth();
  const visibleNavigation = navigation.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="ZelenGrad home">
          <FontAwesomeIcon icon={["fas", "leaf"]} /> ZelenGrad
        </NavLink>
        <nav className="nav" aria-label="Primary navigation">
          {visibleNavigation.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              <FontAwesomeIcon icon={["fas", item.icon]} /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="session-actions">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile">
                <FontAwesomeIcon icon={["fas", "user"]} />
                <span>
                  <span>{user?.name}</span>
                  <small>{user?.role}</small>
                </span>
              </NavLink>
              <button type="button" onClick={() => void logout()}>
                <FontAwesomeIcon icon={["fas", "right-from-bracket"]} /> Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login"><FontAwesomeIcon icon={["fas", "right-to-bracket"]} /> Login</NavLink>
              <NavLink to="/register"><FontAwesomeIcon icon={["fas", "user-plus"]} /> Register</NavLink>
            </>
          )}
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <div>
          <strong><FontAwesomeIcon icon={["fas", "leaf"]} /> ZelenGrad</strong>
          <span>Urban greenery registry and field operations workspace.</span>
        </div>
        <nav aria-label="Footer navigation">
          <NavLink to="/map"><FontAwesomeIcon icon={["fas", "map"]} /> Green Map</NavLink>
          <NavLink to="/about"><FontAwesomeIcon icon={["fas", "circle-info"]} /> About</NavLink>
          {isAuthenticated ? <NavLink to="/profile"><FontAwesomeIcon icon={["fas", "user"]} /> Profile</NavLink> : <NavLink to="/login"><FontAwesomeIcon icon={["fas", "right-to-bracket"]} /> Login</NavLink>}
        </nav>
      </footer>
      <LiveNotifications />
    </div>
  );
};
