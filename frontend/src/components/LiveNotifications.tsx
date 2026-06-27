import { useEffect, useState } from "react";

import { createDashboardEventSource } from "../api";
import { useAuth } from "../auth/AuthContext";

type Notification = {
  id: string;
  title: string;
  detail: string;
  type: string;
};

const eventTypes = [
  "adoption.care_logged",
  "adoption.created",
  "incident.created",
  "incident.updated",
  "maintenance.updated",
  "asset.updated"
];

const getPayload = (data: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const textValue = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

const buildNotification = (type: string, data: string): Notification => {
  const payload = getPayload(data);
  const title = textValue(payload.title);
  const assetName = textValue(payload.assetName);
  const status = textValue(payload.status);
  const action = textValue(payload.action);

  switch (type) {
    case "incident.created":
      return {
        id: crypto.randomUUID(),
        type,
        title: "New incident reported",
        detail: title ? `${title}${status ? ` is ${status.toLowerCase()}` : ""}.` : "A new incident needs review."
      };
    case "incident.updated":
      return {
        id: crypto.randomUUID(),
        type,
        title: "Incident updated",
        detail: title ? `${title}${status ? ` is now ${status.toLowerCase()}` : " was updated"}.` : "An incident was updated."
      };
    case "maintenance.updated":
      return {
        id: crypto.randomUUID(),
        type,
        title: "Maintenance updated",
        detail: title ? `${title}${status ? ` is ${status.toLowerCase()}` : " changed"}.` : "A maintenance task changed."
      };
    case "adoption.created":
      return {
        id: crypto.randomUUID(),
        type,
        title: "Tree adopted",
        detail: assetName ? `${assetName} has a new caretaker.` : "A tree has been adopted."
      };
    case "adoption.care_logged":
      return {
        id: crypto.randomUUID(),
        type,
        title: "Care logged",
        detail: assetName ? `Care activity was logged for ${assetName}.` : "A care activity was logged."
      };
    case "asset.updated":
      return {
        id: crypto.randomUUID(),
        type,
        title: "Asset registry updated",
        detail: action ? `An asset was ${action}.` : "A green asset changed."
      };
    default:
      return {
        id: crypto.randomUUID(),
        type,
        title: "Live update",
        detail: "ZelenGrad data changed."
      };
  }
};

export const LiveNotifications = () => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    const source = createDashboardEventSource();

    for (const type of eventTypes) {
      source.addEventListener(type, (event) => {
        const notification = buildNotification(type, event.data);
        setNotifications((current) => [notification, ...current].slice(0, 4));
      });
    }

    return () => source.close();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!notifications.length) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotifications((current) => current.slice(0, -1));
    }, 7000);

    return () => window.clearTimeout(timeout);
  }, [notifications]);

  if (!notifications.length) {
    return null;
  }

  return (
    <aside className="live-notifications" aria-label="Live notifications" aria-live="polite">
      {notifications.map((notification) => (
        <article className="live-notification" key={notification.id}>
          <div>
            <strong>{notification.title}</strong>
            <span>{notification.detail}</span>
          </div>
          <button
            type="button"
            aria-label={`Dismiss ${notification.title}`}
            onClick={() =>
              setNotifications((current) => current.filter((currentNotification) => currentNotification.id !== notification.id))
            }
          >
            x
          </button>
        </article>
      ))}
    </aside>
  );
};
