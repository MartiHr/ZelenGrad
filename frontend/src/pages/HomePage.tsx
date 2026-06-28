import type { IconName } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "react-router";

import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";

type HomeAction = {
  to: string;
  label: string;
  detail: string;
  icon: IconName;
  group: "primary" | "secondary";
  roles?: UserRole[];
};

const actions: HomeAction[] = [
  {
    to: "/map",
    label: "Explore Green Map",
    detail: "Browse registered trees, parks, gardens, and health status.",
    icon: "map",
    group: "primary"
  },
  {
    to: "/my-forest",
    label: "My Forest",
    detail: "Track adopted trees and log care activity.",
    icon: "tree",
    group: "primary",
    roles: ["CITIZEN"]
  },
  {
    to: "/incidents",
    label: "Review Incidents",
    detail: "Triage citizen reports and update their review status.",
    icon: "triangle-exclamation",
    group: "primary",
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"]
  },
  {
    to: "/worklist",
    label: "Open Worklist",
    detail: "Start, complete, and inspect maintenance assignments.",
    icon: "list-check",
    group: "primary",
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"]
  },
  {
    to: "/dashboard",
    label: "Live Dashboard",
    detail: "Monitor operational metrics and live city activity.",
    icon: "gauge-high",
    group: "primary",
    roles: ["MANAGER", "ADMIN"]
  },
  {
    to: "/zones",
    label: "Zones",
    detail: "Review assigned areas and zone responsibility.",
    icon: "draw-polygon",
    group: "primary",
    roles: ["EMPLOYEE", "MANAGER", "ADMIN"]
  },
  {
    to: "/users",
    label: "Manage Users",
    detail: "Adjust roles, accounts, and reward histories.",
    icon: "users",
    group: "secondary",
    roles: ["ADMIN"]
  },
  {
    to: "/audit",
    label: "Audit History",
    detail: "Inspect recent administrative and operational changes.",
    icon: "clipboard-list",
    group: "secondary",
    roles: ["ADMIN"]
  }
];

const getStartAction = (role: UserRole | undefined): HomeAction => {
  switch (role) {
    case "CITIZEN":
      return actions.find((action) => action.to === "/my-forest")!;
    case "EMPLOYEE":
      return actions.find((action) => action.to === "/worklist")!;
    case "MANAGER":
    case "ADMIN":
      return actions.find((action) => action.to === "/dashboard")!;
    default:
      return actions[0];
  }
};

export const HomePage = () => {
  const { hasRole, isAuthenticated, user } = useAuth();
  const visibleActions = actions.filter((action) => !action.roles || hasRole(...action.roles));
  const primaryActions = visibleActions.filter((action) => action.group === "primary");
  const secondaryActions = visibleActions.filter((action) => action.group === "secondary");
  const startAction = getStartAction(user?.role);

  return (
    <section className="page home-page">
      <div className="home-intro">
        <p className="eyebrow">Urban green infrastructure</p>
        <h1>ZelenGrad</h1>
        <p>
          {isAuthenticated
            ? `Welcome back, ${user?.name}. Your ${user?.role.toLowerCase()} workspace is ready.`
            : "A municipal platform for mapping trees and parks, coordinating maintenance, and helping citizens report and care for green assets."}
        </p>
      </div>

      {!isAuthenticated ? (
        <>
          <div className="home-start-panel">
            <div>
              <span className="eyebrow">Start here</span>
              <h2>Open the city map first.</h2>
              <p>Explore the registry, then log in when you want to report an issue or adopt a tree.</p>
            </div>
            <Link to="/map">Browse map</Link>
          </div>
          <div className="quick-actions">
            <Link to="/map">
              <FontAwesomeIcon icon={["fas", "compass"]} />
              <strong>Browse the map</strong>
              <span>See registered green assets before signing in.</span>
            </Link>
            <Link to="/login">
              <FontAwesomeIcon icon={["fas", "right-to-bracket"]} />
              <strong>Log in</strong>
              <span>Open your citizen or staff workspace.</span>
            </Link>
            <Link to="/register">
              <FontAwesomeIcon icon={["fas", "user-plus"]} />
              <strong>Create citizen account</strong>
              <span>Report incidents and adopt trees.</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="home-start-panel">
            <div>
              <span className="eyebrow">Start here</span>
              <h2>{startAction.label}</h2>
              <p>{startAction.detail}</p>
            </div>
            <Link to={startAction.to}>Open</Link>
          </div>

          <section className="home-section">
            <div className="section-heading">
              <h2>Main Workspace</h2>
              <p className="muted-text">The views you are most likely to use for your role.</p>
            </div>
            <div className="quick-actions">
              {primaryActions.map((action) => (
                <Link key={action.to} to={action.to}>
                  <FontAwesomeIcon icon={["fas", action.icon]} />
                  <strong>{action.label}</strong>
                  <span>{action.detail}</span>
                </Link>
              ))}
            </div>
          </section>

          {secondaryActions.length ? (
            <section className="home-section">
              <div className="section-heading">
                <h2>Management</h2>
                <p className="muted-text">Configuration and administrative tools.</p>
              </div>
              <div className="quick-actions compact-actions">
                {secondaryActions.map((action) => (
                  <Link key={action.to} to={action.to}>
                    <FontAwesomeIcon icon={["fas", action.icon]} />
                    <strong>{action.label}</strong>
                    <span>{action.detail}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
};
