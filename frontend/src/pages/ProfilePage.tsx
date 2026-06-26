import { useAuth } from "../auth/AuthContext";

export const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <section className="page narrow">
      <h1>User Profile</h1>
      <div className="panel profile-summary">
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{user?.role}</dd>
          </div>
          <div>
            <dt>Green Points</dt>
            <dd>{user?.greenPoints}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
};
