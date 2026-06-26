import { NavLink, Outlet } from "react-router";

const navigation = [
  { to: "/", label: "Home" },
  { to: "/map", label: "Green Map" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/my-forest", label: "My Forest" },
  { to: "/worklist", label: "Worklist" },
  { to: "/incidents", label: "Incidents" },
  { to: "/zones", label: "Zones" },
  { to: "/users", label: "Users" }
];

export const AppLayout = () => {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="ZelenGrad home">
          ZelenGrad
        </NavLink>
        <nav className="nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="session-actions">
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/register">Register</NavLink>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
};
