import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const AboutPage = () => {
  return (
    <section className="page narrow">
      <h1><FontAwesomeIcon icon={["fas", "circle-info"]} /> About</h1>
      <p>ZelenGrad connects municipal teams and citizens around healthier urban green spaces.</p>
    </section>
  );
};
