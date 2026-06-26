import { useParams } from "react-router";

export const AssetDetailsPage = () => {
  const { assetId } = useParams();

  return (
    <section className="page">
      <h1>Asset Details</h1>
      <p>Health history, maintenance logs, adoptions, and incidents for asset {assetId}.</p>
    </section>
  );
};
