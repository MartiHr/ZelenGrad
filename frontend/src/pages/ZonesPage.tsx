import { useEffect, useState, type FormEvent } from "react";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  assignments: Array<{
    id: string;
    assignedAt: string;
    employee: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }>;
  _count: {
    assets: number;
    tasks: number;
    incidents: number;
    assignments: number;
  };
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const ZonesPage = () => {
  const { token } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentByZone, setAssignmentByZone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingAssignment, setUpdatingAssignment] = useState<string | null>(null);

  const loadZones = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setZones(await apiRequest<Zone[]>("/zones/management", { token }));
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load zones.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadZones();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiRequest<StaffUser[]>("/users/staff", { token })
      .then(setStaffUsers)
      .catch((caughtError) => {
        setError(caughtError instanceof ApiError ? caughtError.message : "Could not load staff users.");
      });
  }, [token]);

  const createZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setCreateError("Please log in before creating a zone.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const zone = await apiRequest<Zone>("/zones", {
        method: "POST",
        token,
        body: {
          name,
          description: description.trim() || undefined
        }
      });

      setZones((current) => [...current, zone].sort((left, right) => left.name.localeCompare(right.name)));
      setName("");
      setDescription("");
      setCreateSuccess(`Created ${zone.name}.`);
    } catch (caughtError) {
      setCreateError(caughtError instanceof ApiError ? caughtError.message : "Could not create zone.");
    } finally {
      setIsCreating(false);
    }
  };

  const replaceZone = (zone: Zone) => {
    setZones((current) => current.map((currentZone) => (currentZone.id === zone.id ? zone : currentZone)));
  };

  const assignEmployee = async (zone: Zone) => {
    if (!token) {
      setAssignmentError("Please log in before assigning staff.");
      return;
    }

    const employeeId = assignmentByZone[zone.id];

    if (!employeeId) {
      setAssignmentError("Choose a staff member first.");
      return;
    }

    setUpdatingAssignment(`${zone.id}:assign`);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const updatedZone = await apiRequest<Zone>(`/zones/${zone.id}/assignments`, {
        method: "POST",
        token,
        body: { employeeId }
      });

      replaceZone(updatedZone);
      setAssignmentByZone((current) => ({ ...current, [zone.id]: "" }));
      setAssignmentSuccess(`Updated assignments for ${updatedZone.name}.`);
    } catch (caughtError) {
      setAssignmentError(caughtError instanceof ApiError ? caughtError.message : "Could not assign staff user.");
    } finally {
      setUpdatingAssignment(null);
    }
  };

  const removeEmployee = async (zone: Zone, employeeId: string) => {
    if (!token) {
      setAssignmentError("Please log in before removing staff.");
      return;
    }

    setUpdatingAssignment(`${zone.id}:${employeeId}`);
    setAssignmentError(null);
    setAssignmentSuccess(null);

    try {
      const updatedZone = await apiRequest<Zone>(`/zones/${zone.id}/assignments/${employeeId}`, {
        method: "DELETE",
        token
      });

      replaceZone(updatedZone);
      setAssignmentSuccess(`Updated assignments for ${updatedZone.name}.`);
    } catch (caughtError) {
      setAssignmentError(caughtError instanceof ApiError ? caughtError.message : "Could not remove staff user.");
    } finally {
      setUpdatingAssignment(null);
    }
  };

  return (
    <section className="page">
      <h1>Zones Management</h1>
      <p>Manage municipal areas used to organize green assets, incidents, and maintenance work.</p>

      <article className="panel details-panel">
        <h2>Create Zone</h2>
        <form className="inline-form" onSubmit={(event) => void createZone(event)}>
          <div className="form-grid">
            <label>
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                minLength={2}
                required
                placeholder="University District"
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              placeholder="Short operational note for this zone."
            />
          </label>
          {createError ? <p className="form-error">{createError}</p> : null}
          {createSuccess ? <p className="form-success">{createSuccess}</p> : null}
          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Zone"}
          </button>
        </form>
      </article>

      {error ? <p className="form-error">{error}</p> : null}
      {assignmentError ? <p className="form-error">{assignmentError}</p> : null}
      {assignmentSuccess ? <p className="form-success">{assignmentSuccess}</p> : null}

      <div className="asset-grid">
        {isLoading ? <p>Loading zones...</p> : null}
        {!isLoading && zones.length === 0 ? <p>No zones have been created yet.</p> : null}
        {zones.map((zone) => (
          <article className="asset-card" key={zone.id}>
            <div>
              <p className="eyebrow">Zone</p>
              <h2>{zone.name}</h2>
            </div>
            <p>{zone.description ?? "No description has been added for this zone yet."}</p>
            <dl>
              <div>
                <dt>Assets</dt>
                <dd>{zone._count.assets}</dd>
              </div>
              <div>
                <dt>Tasks</dt>
                <dd>{zone._count.tasks}</dd>
              </div>
              <div>
                <dt>Incidents</dt>
                <dd>{zone._count.incidents}</dd>
              </div>
              <div>
                <dt>Assignments</dt>
                <dd>{zone._count.assignments}</dd>
              </div>
            </dl>
            <div className="assignment-panel">
              <h3>Assigned Staff</h3>
              {zone.assignments.length ? (
                <ul className="assignment-list">
                  {zone.assignments.map((assignment) => (
                    <li key={assignment.id}>
                      <span>
                        <strong>{assignment.employee.name}</strong>
                        <small>
                          {assignment.employee.role} | {assignment.employee.email}
                        </small>
                      </span>
                      <button
                        type="button"
                        disabled={updatingAssignment === `${zone.id}:${assignment.employee.id}`}
                        onClick={() => void removeEmployee(zone, assignment.employee.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No staff are assigned to this zone yet.</p>
              )}
              <div className="inline-assignment-form">
                <select
                  value={assignmentByZone[zone.id] ?? ""}
                  onChange={(event) =>
                    setAssignmentByZone((current) => ({ ...current, [zone.id]: event.target.value }))
                  }
                >
                  <option value="">Choose staff</option>
                  {staffUsers.map((staffUser) => (
                    <option key={staffUser.id} value={staffUser.id}>
                      {staffUser.name} ({staffUser.role})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={updatingAssignment === `${zone.id}:assign`}
                  onClick={() => void assignEmployee(zone)}
                >
                  Assign
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
