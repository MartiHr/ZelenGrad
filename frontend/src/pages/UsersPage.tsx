import { useEffect, useMemo, useState, type FormEvent } from "react";

import { ApiError, apiRequest } from "../api";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../auth/authTypes";

type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  greenPoints: number;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RewardTransaction = {
  id: string;
  points: number;
  reason: string;
  description: string | null;
  createdAt: string;
};

type UserFormState = {
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  password: string;
  error: string | null;
  success: string | null;
  isSaving: boolean;
  isDeactivating: boolean;
};

type RewardFormState = {
  points: string;
  description: string;
  error: string | null;
  success: string | null;
  isLoading: boolean;
  isAdjusting: boolean;
};

const roles: UserRole[] = ["CITIZEN", "EMPLOYEE", "MANAGER", "ADMIN"];

const createUserForm = (user: ManagedUser): UserFormState => ({
  email: user.email,
  name: user.name,
  role: user.role,
  isActive: user.isActive,
  password: "",
  error: null,
  success: null,
  isSaving: false,
  isDeactivating: false
});

const createRewardForm = (): RewardFormState => ({
  points: "",
  description: "",
  error: null,
  success: null,
  isLoading: false,
  isAdjusting: false
});

const formatDate = (value: string | null) => {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

export const UsersPage = () => {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [forms, setForms] = useState<Record<string, UserFormState>>({});
  const [rewardForms, setRewardForms] = useState<Record<string, RewardFormState>>({});
  const [rewardsByUser, setRewardsByUser] = useState<Record<string, RewardTransaction[]>>({});
  const [emailFilter, setEmailFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedRewardsUserId, setExpandedRewardsUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (emailFilter.trim()) {
      params.set("email", emailFilter.trim());
    }

    if (roleFilter) {
      params.set("role", roleFilter);
    }

    if (activeFilter) {
      params.set("isActive", activeFilter);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [activeFilter, emailFilter, roleFilter]);

  const loadUsers = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextUsers = await apiRequest<ManagedUser[]>(`/users${query}`, { token });
      setUsers(nextUsers);
      setForms((current) =>
        nextUsers.reduce<Record<string, UserFormState>>((nextForms, managedUser) => {
          nextForms[managedUser.id] = current[managedUser.id] ?? createUserForm(managedUser);
          return nextForms;
        }, {})
      );
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not load users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [query, token]);

  const updateForm = (userId: string, patch: Partial<UserFormState>) => {
    setForms((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? createUserForm(users.find((managedUser) => managedUser.id === userId)!)),
        ...patch
      }
    }));
  };

  const updateRewardForm = (userId: string, patch: Partial<RewardFormState>) => {
    setRewardForms((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] ?? createRewardForm()),
        ...patch
      }
    }));
  };

  const loadRewards = async (managedUser: ManagedUser) => {
    if (!token) {
      updateRewardForm(managedUser.id, { error: "Please log in before loading rewards." });
      return;
    }

    updateRewardForm(managedUser.id, { error: null, success: null, isLoading: true });
    setExpandedRewardsUserId(managedUser.id);

    try {
      const rewards = await apiRequest<RewardTransaction[]>(`/rewards?userId=${managedUser.id}`, { token });
      setRewardsByUser((current) => ({ ...current, [managedUser.id]: rewards }));
      updateRewardForm(managedUser.id, { isLoading: false });
    } catch (caughtError) {
      updateRewardForm(managedUser.id, {
        error: caughtError instanceof ApiError ? caughtError.message : "Could not load reward history.",
        isLoading: false
      });
    }
  };

  const adjustRewards = async (event: FormEvent<HTMLFormElement>, managedUser: ManagedUser) => {
    event.preventDefault();

    if (!token) {
      updateRewardForm(managedUser.id, { error: "Please log in before adjusting rewards." });
      return;
    }

    const form = rewardForms[managedUser.id] ?? createRewardForm();

    updateRewardForm(managedUser.id, { error: null, success: null, isAdjusting: true });

    try {
      const reward = await apiRequest<RewardTransaction>(`/rewards/${managedUser.id}`, {
        method: "PUT",
        token,
        body: {
          points: form.points,
          description: form.description
        }
      });

      setRewardsByUser((current) => ({
        ...current,
        [managedUser.id]: [reward, ...(current[managedUser.id] ?? [])]
      }));
      setUsers((current) =>
        current.map((user) =>
          user.id === managedUser.id ? { ...user, greenPoints: user.greenPoints + reward.points } : user
        )
      );
      updateRewardForm(managedUser.id, {
        points: "",
        description: "",
        success: "Reward adjustment recorded.",
        isAdjusting: false
      });
    } catch (caughtError) {
      updateRewardForm(managedUser.id, {
        error: caughtError instanceof ApiError ? caughtError.message : "Could not adjust rewards.",
        isAdjusting: false
      });
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>, managedUser: ManagedUser) => {
    event.preventDefault();

    if (!token) {
      updateForm(managedUser.id, { error: "Please log in before updating users." });
      return;
    }

    const form = forms[managedUser.id] ?? createUserForm(managedUser);

    updateForm(managedUser.id, { error: null, success: null, isSaving: true });

    try {
      const updatedUser = await apiRequest<ManagedUser>(`/users/${managedUser.id}`, {
        method: "PUT",
        token,
        body: {
          email: form.email,
          name: form.name,
          role: form.role,
          isActive: form.isActive,
          password: form.password || undefined
        }
      });

      setUsers((current) => current.map((user) => (user.id === managedUser.id ? updatedUser : user)));
      setForms((current) => ({
        ...current,
        [managedUser.id]: {
          ...createUserForm(updatedUser),
          success: "User updated."
        }
      }));
    } catch (caughtError) {
      updateForm(managedUser.id, {
        error: caughtError instanceof ApiError ? caughtError.message : "Could not update user.",
        isSaving: false
      });
    }
  };

  const deactivateManagedUser = async (managedUser: ManagedUser) => {
    if (!token) {
      updateForm(managedUser.id, { error: "Please log in before deactivating users." });
      return;
    }

    const shouldDeactivate = window.confirm(`Deactivate ${managedUser.email}?`);

    if (!shouldDeactivate) {
      return;
    }

    updateForm(managedUser.id, { error: null, success: null, isDeactivating: true });

    try {
      const updatedUser = await apiRequest<ManagedUser>(`/users/${managedUser.id}`, {
        method: "DELETE",
        token
      });

      setUsers((current) => current.map((user) => (user.id === managedUser.id ? updatedUser : user)));
      setForms((current) => ({
        ...current,
        [managedUser.id]: {
          ...createUserForm(updatedUser),
          success: "User deactivated."
        }
      }));
    } catch (caughtError) {
      updateForm(managedUser.id, {
        error: caughtError instanceof ApiError ? caughtError.message : "Could not deactivate user.",
        isDeactivating: false
      });
    }
  };

  return (
    <section className="page">
      <h1>Users</h1>
      <p>Filter accounts, adjust roles, reset passwords, and deactivate users.</p>

      <div className="toolbar">
        <label>
          Email
          <input
            value={emailFilter}
            onChange={(event) => setEmailFilter(event.target.value)}
            placeholder="citizen@example.com"
          />
        </label>
        <label>
          Role
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="worklist-summary">
        <span>{users.length} visible users</span>
        <span>{users.filter((managedUser) => managedUser.isActive).length} active</span>
        <span>{users.filter((managedUser) => !managedUser.isActive).length} inactive</span>
        <span>{users.filter((managedUser) => managedUser.role !== "CITIZEN").length} staff</span>
      </div>

      <div className="user-list">
        {isLoading ? <p>Loading users...</p> : null}
        {!isLoading && users.length === 0 ? <p>No users match the current filters.</p> : null}
        {users.map((managedUser) => {
          const form = forms[managedUser.id] ?? createUserForm(managedUser);
          const rewardForm = rewardForms[managedUser.id] ?? createRewardForm();
          const rewards = rewardsByUser[managedUser.id];
          const isSelf = currentUser?.id === managedUser.id;

          return (
            <article className={`user-card ${managedUser.isActive ? "" : "is-inactive"}`} key={managedUser.id}>
              <header>
                <div>
                  <p className="eyebrow">{managedUser.role}</p>
                  <h2>{managedUser.name}</h2>
                  <p className="muted-text">{managedUser.email}</p>
                </div>
                <div className="task-chip-row">
                  <span className={`badge user-status-badge ${managedUser.isActive ? "active" : "inactive"}`}>
                    {managedUser.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                  {isSelf ? <span className="badge">YOU</span> : null}
                </div>
              </header>

              <dl>
                <div>
                  <dt>Points</dt>
                  <dd>{managedUser.greenPoints}</dd>
                </div>
                <div>
                  <dt>Last login</dt>
                  <dd>{formatDate(managedUser.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(managedUser.createdAt)}</dd>
                </div>
              </dl>

              <div className="button-row">
                <button
                  type="button"
                  className="muted-button"
                  onClick={() => setExpandedUserId((current) => (current === managedUser.id ? null : managedUser.id))}
                >
                  {expandedUserId === managedUser.id ? "Hide Admin Tools" : "Admin Tools"}
                </button>
                <button
                  type="button"
                  className="muted-button"
                  onClick={() =>
                    setExpandedRewardsUserId((current) => (current === managedUser.id ? null : managedUser.id))
                  }
                >
                  {expandedRewardsUserId === managedUser.id ? "Hide Rewards" : "Rewards"}
                </button>
              </div>

              {expandedUserId === managedUser.id ? (
              <form className="inline-form" onSubmit={(event) => void saveUser(event, managedUser)}>
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={form.name}
                      onChange={(event) => updateForm(managedUser.id, { name: event.target.value })}
                      maxLength={120}
                      minLength={2}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      value={form.email}
                      onChange={(event) => updateForm(managedUser.id, { email: event.target.value })}
                      maxLength={255}
                      required
                      type="email"
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={form.role}
                      onChange={(event) => updateForm(managedUser.id, { role: event.target.value as UserRole })}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={String(form.isActive)}
                      onChange={(event) => updateForm(managedUser.id, { isActive: event.target.value === "true" })}
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </label>
                  <label>
                    New password
                    <input
                      value={form.password}
                      onChange={(event) => updateForm(managedUser.id, { password: event.target.value })}
                      minLength={8}
                      placeholder="Leave blank"
                      type="password"
                    />
                  </label>
                </div>

                {form.error ? <p className="form-error">{form.error}</p> : null}
                {form.success ? <p className="form-success">{form.success}</p> : null}

                <div className="button-row">
                  <button type="submit" disabled={form.isSaving}>
                    {form.isSaving ? "Saving..." : "Save User"}
                  </button>
                  <button
                    className={managedUser.isActive ? "danger-button strong-danger-button" : "muted-button"}
                    disabled={form.isDeactivating || !managedUser.isActive || isSelf}
                    onClick={() => void deactivateManagedUser(managedUser)}
                    type="button"
                  >
                    {form.isDeactivating ? "Deactivating..." : managedUser.isActive ? "Deactivate Account" : "Already Inactive"}
                  </button>
                </div>
              </form>
              ) : null}

              {expandedRewardsUserId === managedUser.id ? (
              <section className="reward-panel">
                <div className="button-row">
                  <button
                    type="button"
                    disabled={rewardForm.isLoading}
                    onClick={() => void loadRewards(managedUser)}
                  >
                    {rewardForm.isLoading ? "Loading..." : "Load Rewards"}
                  </button>
                </div>

                <form className="inline-form" onSubmit={(event) => void adjustRewards(event, managedUser)}>
                  <div className="form-grid">
                    <label>
                      Point adjustment
                      <input
                        value={rewardForm.points}
                        onChange={(event) => updateRewardForm(managedUser.id, { points: event.target.value })}
                        placeholder="+5 or -3"
                        required
                        type="number"
                      />
                    </label>
                    <label>
                      Description
                      <input
                        value={rewardForm.description}
                        onChange={(event) => updateRewardForm(managedUser.id, { description: event.target.value })}
                        maxLength={1000}
                        minLength={3}
                        required
                        placeholder="Manual correction"
                      />
                    </label>
                  </div>
                  {rewardForm.error ? <p className="form-error">{rewardForm.error}</p> : null}
                  {rewardForm.success ? <p className="form-success">{rewardForm.success}</p> : null}
                  <button type="submit" disabled={rewardForm.isAdjusting}>
                    {rewardForm.isAdjusting ? "Recording..." : "Adjust Points"}
                  </button>
                </form>

                {rewards ? (
                  rewards.length ? (
                    <ul className="timeline">
                      {rewards.map((reward) => (
                        <li key={reward.id}>
                          <strong>
                            {reward.points > 0 ? "+" : ""}
                            {reward.points} points
                          </strong>
                          <span>
                            {reward.reason} · {formatDate(reward.createdAt)}
                          </span>
                          <p>{reward.description ?? "No description was added."}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No reward transactions have been recorded for this user.</p>
                  )
                ) : null}
              </section>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};
