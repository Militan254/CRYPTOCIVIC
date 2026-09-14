type Election = {
  election_id: number;
  title: string;
  position: string;
  election_scope: "SCHOOL" | "UNIVERSITY";
  school_name: string | null;
  start_time: string;
  end_time: string;
  status: "UPCOMING" | "ACTIVE" | "CLOSED";
};

type AdminElectionCardProps = {
  election: Election;
  onActivate: (
    electionId: number
  ) => void;
  onClose: (
    electionId: number
  ) => void;
  onViewResults: (
    electionId: number
  ) => void;
  onDelete: (
    electionId: number
  ) => void;
};

export default function AdminElectionCard({
  election,
  onActivate,
  onClose,
  onViewResults,
  onDelete,
}: AdminElectionCardProps) {
  return (
    <article
      className="election-card admin-election-card"
      onClick={() => onViewResults(election.election_id)}
    >
      <span
        className={`status ${election.status.toLowerCase()}`}
      >
        {election.status}
      </span>

      <h3>
        {election.title}
      </h3>

      <p>
        {election.position}
      </p>

      <small>
        Scope: {election.election_scope}
      </small>

      {election.school_name && (
        <small>
          School: {election.school_name}
        </small>
      )}

      <div className="admin-election-actions">
        {election.status === "UPCOMING" && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onActivate(election.election_id);
            }}
          >
            Activate
          </button>
        )}

        {election.status === "ACTIVE" && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onClose(election.election_id);
            }}
          >
            Close election
          </button>
        )}

        {election.status === "CLOSED" && (
          <button
            className="danger-button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(election.election_id);
            }}
          >
            Delete election
          </button>
        )}

        <button
          className="secondary-button"
          onClick={(event) => {
            event.stopPropagation();
            onViewResults(election.election_id);
          }}
        >
          {election.status === "CLOSED" ? "View results" : "View live results"}
        </button>
      </div>
    </article>
  );
}

