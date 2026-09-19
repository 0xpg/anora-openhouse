import { FacilityCard } from "./FacilityCard";
import { useNextFacilityId, usePoolBoard } from "../hooks/usePool";

export function FacilitiesList() {
  const { data: nextId, isLoading, error } = useNextFacilityId();
  const { board } = usePoolBoard();

  if (error) return <section className="panel">Could not load facilities: {error.message}</section>;
  if (isLoading || nextId === undefined) return <section className="panel">Loading facilities...</section>;

  const count = Number(nextId);
  const ids = Array.from({ length: count }, (_, i) => count - 1 - i);

  return (
    <section className="panel">
      <h2>Facilities</h2>
      {ids.length === 0 && <p className="muted">No facilities opened yet.</p>}
      <div className="card-list">
        {ids.map((id) => (
          <FacilityCard key={id} id={id} board={board} />
        ))}
      </div>
    </section>
  );
}
