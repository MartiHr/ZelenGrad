import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";

import { ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { isValidEmail, validateRequiredText, type FieldErrors } from "../validation";

type LoginField = "email" | "password";

export const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/profile";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFieldErrors: FieldErrors<LoginField> = {};
    const trimmedEmail = email.trim();

    if (!isValidEmail(trimmedEmail)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }

    const passwordError = validateRequiredText(password, "Password");
    if (passwordError) {
      nextFieldErrors.password = passwordError;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(null);
      return;
    }

    setFieldErrors({});
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email: trimmedEmail, password });
      navigate(from, { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not log in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page narrow">
      <h1>Login</h1>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input
            aria-invalid={Boolean(fieldErrors.email)}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
        </label>
        <label>
          Password
          <input
            aria-invalid={Boolean(fieldErrors.password)}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>
    </section>
  );
};
