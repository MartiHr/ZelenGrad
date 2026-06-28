import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";

import { ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { isValidEmail, validateRequiredText, type FieldErrors } from "../validation";

type RegisterField = "name" | "email" | "password";

export const RegisterPage = () => {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterField>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextFieldErrors: FieldErrors<RegisterField> = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const nameError = validateRequiredText(trimmedName, "Name", 2);

    if (nameError) {
      nextFieldErrors.name = nameError;
    }

    if (!isValidEmail(trimmedEmail)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }

    if (password.length < 8) {
      nextFieldErrors.password = "Password must be at least 8 characters.";
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
      await register({ name: trimmedName, email: trimmedEmail, password });
      navigate("/profile", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : "Could not register.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="page narrow">
      <h1>Register</h1>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <label>
          Name
          <input
            aria-invalid={Boolean(fieldErrors.name)}
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            required
          />
          {fieldErrors.name ? <span className="field-error">{fieldErrors.name}</span> : null}
        </label>
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
            minLength={8}
            required
          />
          {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Creating account..."
            : <><FontAwesomeIcon icon={["fas", "user-plus"]} /> Create account</>}
        </button>
      </form>
    </section>
  );
};
