import { Link } from "react-router";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";

type HomeAction = {
  to: string;
  label: string;
  detail: string;
  roles?: UserRole[];
};

const actions: HomeAction[] = [
  {
    to: "/map",
    label: "Explore Green Map",
    detail: "Browse registered trees, parks, gardens, and health status."
  },
  {
    to: "/my-forest",
    label: "My Forest",
    detail: "Track adopted trees and log care activity.",
    roles: ["CITIZEN"]
  },
  {
    to: "/incidents",
    label: "Review Incidents",
    detail: "Triage citizen reports and update their review status.",
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"]
  },
  {
    to: "/worklist",
    label: "Open Worklist",
    detail: "Start, complete, and inspect maintenance assignments.",
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"]
  },
  {
    to: "/dashboard",
    label: "Live Dashboard",
    detail: "Monitor operational metrics and live city activity.",
    roles: ["MANAGER", "ADMIN"]
  },
  {
    to: "/zones",
    label: "Manage Zones",
    detail: "Coordinate areas and staff responsibility.",
    roles: ["MANAGER", "ADMIN"]
  },
  {
    to: "/users",
    label: "Manage Users",
    detail: "Adjust roles, accounts, and reward histories.",
    roles: ["ADMIN"]
  }
];

export const HomePage = () => {
  const { hasRole, isAuthenticated, user } = useAuth();
  const visibleActions = actions.filter((action) => !action.roles || hasRole(...action.roles));

  return (
    <section className="page">
      <p className="eyebrow">Urban green infrastructure</p>
      <h1>ZelenGrad</h1>
      <p>
        {isAuthenticated
          ? `Welcome back, ${user?.name}. Your ${user?.role.toLowerCase()} workspace is ready.`
          : "A municipal platform for mapping trees and parks, coordinating maintenance, and helping citizens report and care for green assets."}
      </p>

      {!isAuthenticated ? (
        <div className="quick-actions">
          <Link to="/map">
            <strong>Browse the map</strong>
            <span>See registered green assets before signing in.</span>
          </Link>
          <Link to="/login">
            <strong>Log in</strong>
            <span>Open your citizen or staff workspace.</span>
          </Link>
          <Link to="/register">
            <strong>Create citizen account</strong>
            <span>Report incidents and adopt trees.</span>
          </Link>
        </div>
      ) : (
        <div className="quick-actions">
          {visibleActions.map((action) => (
            <Link key={action.to} to={action.to}>
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};
