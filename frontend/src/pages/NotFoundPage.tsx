import { Link } from "react-router";

export const NotFoundPage = () => {
  return (
    <section className="page narrow">
      <h1>Page not found</h1>
      <p>The requested ZelenGrad view does not exist yet.</p>
      <Link to="/">Return home</Link>
    </section>
  );
};
